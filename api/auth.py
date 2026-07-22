"""
Authentication module for OTP-based signup and social login.
Implements secure OTP storage with expiration and rate limiting.
"""

from fastapi import APIRouter, HTTPException, Body
import random
import string
import time
import hashlib
import secrets
from collections import OrderedDict
from typing import Dict

router = APIRouter()

# ============================================================================
# OTP Configuration Constants
# ============================================================================
OTP_EXPIRATION_SECONDS = 300  # OTP expires after 5 minutes
OTP_MAX_ATTEMPTS = 5  # Maximum verification attempts before lockout
OTP_RATE_LIMIT_SECONDS = 60  # Minimum time between OTP generation requests
OTP_LENGTH = 6  # Length of OTP code

# Hard caps to prevent unbounded memory growth from anonymous callers.
# The identifier length cap blocks attackers from stuffing megabytes of data
# per request, and the store cap enforces LRU eviction so total memory used
# by the OTP subsystem is bounded regardless of request volume.
MAX_IDENTIFIER_LENGTH = 254  # Enough for a valid email (RFC 5321)
MAX_OTP_STORE_ENTRIES = 10_000
MAX_RATE_LIMIT_ENTRIES = 10_000


# ============================================================================
# Secure In-Memory OTP Store (bounded, LRU-evicted)
# ============================================================================
# OrderedDict lets us evict the oldest entry in O(1) when we hit the cap,
# which prevents an attacker from exhausting server memory by sending many
# requests with unique identifiers.
otp_store: "OrderedDict[str, Dict]" = OrderedDict()
rate_limit_store: "OrderedDict[str, float]" = OrderedDict()


def _enforce_store_cap(store: OrderedDict, max_entries: int) -> None:
    """Evict oldest entries until the store is within its size cap."""
    while len(store) > max_entries:
        store.popitem(last=False)



def _generate_otp(length: int = OTP_LENGTH) -> str:
    """
    Generate a cryptographically secure OTP code.
    Uses secrets module for better randomness than random.choices.
    """
    return "".join(secrets.choice(string.digits) for _ in range(length))


def _hash_otp(otp: str) -> str:
    """
    Hash OTP for secure storage. Never store plain OTPs.
    Uses SHA-256 for one-way hashing.
    """
    return hashlib.sha256(otp.encode()).hexdigest()


def _is_rate_limited(identifier: str) -> bool:
    """
    Check if identifier is rate limited for OTP generation.
    Prevents abuse by limiting how often OTPs can be requested.
    """
    last_request = rate_limit_store.get(identifier)
    if last_request is None:
        return False
    return (time.time() - last_request) < OTP_RATE_LIMIT_SECONDS


def _is_otp_expired(created_at: float) -> bool:
    """Check if OTP has expired based on creation timestamp."""
    return (time.time() - created_at) > OTP_EXPIRATION_SECONDS


def _cleanup_expired_otps() -> None:
    """
    Remove expired OTPs from store to prevent memory buildup.
    Called periodically during OTP operations.
    """
    current_time = time.time()
    expired_keys = [
        key for key, data in otp_store.items()
        if (current_time - data["created_at"]) > OTP_EXPIRATION_SECONDS
    ]
    for key in expired_keys:
        del otp_store[key]


@router.post("/signup")
def signup(identifier: str = Body(..., embed=True)):
    """
    Signup using email or phone.
    Generates and stores a hashed OTP with expiration.

    Security features:
    - Identifier length is validated to block memory-exhaustion attacks
    - Rate limiting prevents abuse
    - OTP store is capped and LRU-evicted to bound memory usage
    - OTPs are hashed before storage
    - OTPs expire after 5 minutes
    - OTP value is NOT returned in response (must be sent via email/SMS)
    """
    # Reject oversized or empty identifiers up front. This prevents an anonymous
    # caller from stuffing arbitrarily large strings into the in-memory store.
    if not isinstance(identifier, str) or not identifier.strip():
        raise HTTPException(status_code=400, detail="Invalid identifier")
    if len(identifier) > MAX_IDENTIFIER_LENGTH:
        raise HTTPException(status_code=400, detail="Identifier too long")

    # Clean up expired OTPs periodically
    _cleanup_expired_otps()

    # Check rate limiting to prevent abuse
    if _is_rate_limited(identifier):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait before requesting another OTP."
        )

    # Generate secure OTP
    otp = _generate_otp()

    # Store hashed OTP with metadata (NEVER store plain OTP). Using move_to_end
    # keeps the OrderedDict ordered by most-recent write so LRU eviction below
    # drops the oldest inactive entries first.
    otp_store[identifier] = {
        "otp_hash": _hash_otp(otp),
        "created_at": time.time(),
        "attempts": 0
    }
    otp_store.move_to_end(identifier)

    # Update rate limit tracking
    rate_limit_store[identifier] = time.time()
    rate_limit_store.move_to_end(identifier)

    # Enforce hard caps so anonymous traffic cannot grow memory without bound.
    _enforce_store_cap(otp_store, MAX_OTP_STORE_ENTRIES)
    _enforce_store_cap(rate_limit_store, MAX_RATE_LIMIT_ENTRIES)

    # TODO: In production, send OTP via email/SMS here
    # send_otp_via_email(identifier, otp) or send_otp_via_sms(identifier, otp)

    # SECURITY: Do NOT return OTP in response - it must be sent via secure channel
    return {"message": "OTP sent"}



@router.post("/verify")
def verify(identifier: str = Body(..., embed=True), otp: str = Body(..., embed=True)):
    """
    Verify OTP for email/phone authentication.
    
    Security features:
    - Brute force protection with attempt limiting
    - OTP expiration checking
    - Secure hash comparison
    - Cleanup after successful verification
    """
    stored = otp_store.get(identifier)
    
    # Check if OTP exists for this identifier
    # Note: If OTP is not found, it may have expired, been used, or the server
    # may have restarted (in-memory storage limitation). Provide helpful message.
    if not stored:
        raise HTTPException(
            status_code=400,
            detail="OTP not found. This may be due to expiration, server maintenance, or the OTP was already used. Please request a new OTP."
        )
    
    # Check if OTP has expired
    if _is_otp_expired(stored["created_at"]):
        del otp_store[identifier]  # Clean up expired OTP
        raise HTTPException(
            status_code=400,
            detail="OTP has expired. Please request a new one."
        )
    
    # Check brute force protection
    if stored["attempts"] >= OTP_MAX_ATTEMPTS:
        del otp_store[identifier]  # Lockout - require new OTP
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Please request a new OTP."
        )
    
    # Increment attempt counter before verification
    stored["attempts"] += 1
    
    # Secure hash comparison to verify OTP
    if _hash_otp(otp) != stored["otp_hash"]:
        remaining = OTP_MAX_ATTEMPTS - stored["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid OTP. {remaining} attempts remaining."
        )
    
    # Success - clean up OTP data
    del otp_store[identifier]
    
    # Generate secure session token
    session_token = secrets.token_urlsafe(32)

    return {"message": "Verification successful", "token": session_token}

# ============================================================================
# NOTE: social-login and gdpr-delete endpoints have been removed.
# 
# The application uses Supabase Auth for authentication (see src/pages/Auth.tsx):
# - Email/password authentication with proper validation
# - Google OAuth with secure redirect configuration
# 
# For GDPR data deletion, use Supabase's built-in user management:
# - Supabase Dashboard > Authentication > Users
# - Or implement via Supabase Admin SDK with proper authentication
# ============================================================================