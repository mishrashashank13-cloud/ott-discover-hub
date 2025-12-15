"""
FastAPI backend for OTT content tracking application.
Handles TMDB API integration, user reminders, and scheduled notifications.

Security: All cron/admin endpoints require API key authentication.
"""

import os
import logging
import time
import hmac
import hashlib
from datetime import date, datetime, timedelta
from fastapi import FastAPI, Query, HTTPException, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
import requests
from dotenv import load_dotenv
import pytz
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from auth import router as auth_router  # added auth router import

# Load environment variables first
load_dotenv()

# ============================================================================
# Environment Configuration
# ============================================================================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

# API Key for authenticating cron/admin endpoints (must be set in production)
CRON_API_KEY = os.getenv("CRON_API_KEY")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

# TMDB API configuration (no hardcoded fallback for security)
TMDB_TOKEN = os.getenv("TMDB_ACCESS_TOKEN")
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

# Validate TMDB configuration on startup
if not TMDB_TOKEN and not TMDB_API_KEY:
    logger.warning("TMDB credentials not configured. TMDB API calls will fail.")

TMDB_BASE = "https://api.themoviedb.org/3"

app = FastAPI()

# ALLOWED_ORIGINS can be a comma-separated list of allowed origins
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://yourapp.lovable.app").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth")  # mount auth endpoints


# ============================================================================
# API Key Authentication Dependency
# Used to secure cron/admin endpoints from unauthorized access
# ============================================================================
async def verify_cron_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    """
    Verify API key for cron/admin endpoints.
    This dependency ensures only authorized callers can trigger scheduled tasks.
    
    The API key should be:
    - Set via CRON_API_KEY environment variable
    - Passed in X-API-Key header by the caller
    - Used by your scheduler (e.g., Vercel Cron, Railway Cron) to authenticate
    """
    if not CRON_API_KEY:
        logger.error("CRON_API_KEY not configured - rejecting request")
        raise HTTPException(
            status_code=500,
            detail="Server misconfigured: CRON_API_KEY not set"
        )
    
    if not x_api_key:
        logger.warning("Cron endpoint called without API key")
        raise HTTPException(
            status_code=401,
            detail="Missing X-API-Key header"
        )
    
    # Use constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(x_api_key, CRON_API_KEY):
        logger.warning("Cron endpoint called with invalid API key")
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )
    
    return True


# Simple access logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        client = request.client.host if request.client else "-"
        path = request.url.path + (f"?{request.url.query}" if request.url.query else "")
        status = response.status_code if response is not None else 500
        logger.info('%s - "%s %s" %s %.2fms', client, request.method, path, status, duration_ms)


@app.get("/api/upcoming-shows")
def upcoming_shows(page: int = Query(1, ge=1), language: str = "en-US"):
    today = date.today().isoformat()
    discover_url = f"{TMDB_BASE}/discover/tv"
    headers = {"Authorization": f"Bearer {TMDB_TOKEN}"} if TMDB_TOKEN else {}

    # Region and provider filtering (India)
    provider_names = [
        "JioHotstar", "Amazon Prime Video", "Netflix", "ZEE5", "SonyLIV",
        "Amazon MX Player", "ALTBalaji", "Aha", "Sun NXT", "ShemarooMe",
        "Amazon miniTV", "Eros Now", "Hoichoi", "TVFPlay", "Apple TV+",
        "Discovery+", "Lionsgate Play", "Mubi", "Hungama Play", "Viu",
        "Arre", "Stage", "ManoramaMAX", "Chaupal", "Planet Marathi",
        "EPIC ON", "JioTV", "BigFlix", "Spuul", "NammaFlix", "ReelDrama",
        "Klikk", "Kanccha Lannka", "Kurinji", "Neestream", "Simply South",
        "Tentkotta", "YuppTV", "HoiChoi TV (different from Hoichoi)",
        "Disney+ (global app variant)", "Crunchyroll", "DocuBay", "ShortsTV",
    ]

    def _norm(s: str) -> str:
        return "".join(ch.lower() for ch in s or "" if ch.isalnum())

    provider_ids = ""
    try:
        providers_resp = requests.get(
            f"{TMDB_BASE}/watch/providers/tv",
            headers=headers,
            params={"watch_region": "IN", **({"api_key": TMDB_API_KEY} if not TMDB_TOKEN else {})},
            timeout=10,
        )
        if providers_resp.status_code == 200:
            providers = providers_resp.json().get("results", [])
            desired = {_norm(name) for name in provider_names}
            matched_ids = []
            for p in providers:
                name = str(p.get("provider_name", ""))
                if _norm(name) in desired and p.get("provider_id") is not None:
                    matched_ids.append(str(p["provider_id"]))
            if matched_ids:
                provider_ids = ",".join(sorted(set(matched_ids)))
        else:
            logger.warning(
                "Failed to fetch watch providers: %s %s",
                providers_resp.status_code,
                providers_resp.text[:200],
            )
    except requests.RequestException as e:
        logger.warning("Watch providers request failed: %s", e)

    params = {
        "language": language,
        "sort_by": "first_air_date.asc",
        "first_air_date.gte": today,  # future releases only
        "page": page,
        "watch_region": "IN",  # region = India
        "include_adult": "false",
    }
    if not TMDB_TOKEN:
        params["api_key"] = TMDB_API_KEY
    if provider_ids:
        params["with_watch_providers"] = provider_ids

    try:
        r = requests.get(discover_url, headers=headers, params=params, timeout=10)
    except requests.RequestException as e:
        logger.error("TMDB request failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()


def _ist_now_date() -> date:
    ist = pytz.timezone("Asia/Kolkata")
    return datetime.now(tz=ist).date()


def _is_thursday_ist_now() -> bool:
    ist = pytz.timezone("Asia/Kolkata")
    return datetime.now(tz=ist).weekday() == 3  # 0=Mon ... 3=Thu


def _fetch_supabase(path: str, params=None, method: str = "GET", json_body=None):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",  # added Accept header
        "Prefer": "return=representation",
    }
    resp = requests.request(method, url, headers=headers, params=params, json=json_body, timeout=15)
    return resp


def _list_due_reminders_for_today() -> list[dict]:
    today = _ist_now_date()
    seven_days_ahead = today + timedelta(days=7)
    # Due if release_date in [today, today+7] and either last_notified_on is null or < today
    params = {
        "select": "*, profiles:profiles!inner(email, mobile_number)",
        "release_date": f"lte.{seven_days_ahead.isoformat()}",
        "last_notified_on": f"lt.{today.isoformat()}",
    }
    # We also want reminders where last_notified_on is null; Supabase filter supports or
    params["or"] = f"(last_notified_on.is.null,last_notified_on.lt.{today.isoformat()})"
    resp = _fetch_supabase("reminders", params=params)
    if resp.status_code not in (200, 206):
        logger.error("Failed to fetch reminders: %s %s", resp.status_code, resp.text[:200])
        return []
    return resp.json()


def _list_new_releases_for_week() -> list[dict]:
    today = _ist_now_date()
    start = today - timedelta(days=today.weekday())  # Monday
    end = start + timedelta(days=6)  # Sunday
    # For demo, reuse TMDB discover upcoming with week window
    headers = {"Authorization": f"Bearer {TMDB_TOKEN}"} if TMDB_TOKEN else {}
    params = {
        "language": "en-US",
        "sort_by": "first_air_date.desc",
        "first_air_date.gte": start.isoformat(),
        "first_air_date.lte": end.isoformat(),
        "page": 1,
    }
    if not TMDB_TOKEN:
        params["api_key"] = TMDB_API_KEY
    r = requests.get(f"{TMDB_BASE}/discover/tv", headers=headers, params=params, timeout=10)
    if r.status_code != 200:
        logger.warning("Weekly releases fetch failed: %s %s", r.status_code, r.text[:120])
        return []
    data = r.json()
    return data.get("results", [])


@app.post("/api/cron/daily-reminders")
def cron_daily_reminders(authenticated: bool = Depends(verify_cron_api_key)):
    """
    Send daily reminder notifications to users.
    PROTECTED: Requires valid X-API-Key header.
    Should be called by scheduler around 8AM IST.
    """
    reminders = _list_due_reminders_for_today()
    if not reminders:
        return {"sent": 0}

    # Build notifications per user
    sent = 0
    for rem in reminders:
        user_id = rem.get("user_id")
        profile = rem.get("profiles") or {}
        email = profile.get("email")
        phone = profile.get("mobile_number")
        release_date_str = rem.get("release_date")
        title = rem.get("content_title") or rem.get("content_id")
        message = {
            "subject": f"Reminder: {title} releasing on {release_date_str}",
            "bodyText": f"Hi! Your reminder for '{title}'. Release date: {release_date_str}. We'll keep you posted.",
        }
        try:
            _notify_via_edge(email, phone, message)  # _notify_via_edge is called here for each reminder
            sent += 1
        except Exception as e:
            logger.warning("Notification failed for user %s: %s", user_id, e)
            continue

        # Mark notified today
        today = _ist_now_date().isoformat()
        _fetch_supabase(
            f"reminders?id=eq.{rem['id']}",
            method="PATCH",
            json_body={"last_notified_on": today},
        )

    return {"sent": sent}


def _notify_via_edge(email: str | None, phone: str | None, message: dict):
    # This function is a placeholder. In a real deployment, wire provider SDKs in Python
    # or call a separate edge function responsible for notifications.
    if not email and not phone:
        raise RuntimeError("No contact methods")
    # Retrieve Gmail credentials from environment variables for security
    sender_email = os.getenv("GMAIL_SENDER_EMAIL")
    sender_password = os.getenv("GMAIL_APP_PASSWORD")
    
    if not sender_email or not sender_password:
        logger.error("Gmail credentials not configured in environment variables")
        raise RuntimeError("Email credentials not configured")
    
    send_email(
        sender_email=sender_email,
        sender_password=sender_password,
        receiver_email=email,
        subject=message.get("subject"),
        body=message.get("bodyText"))
    # For now just log
    logger.info("Notify email=%s phone=%s subject=%s", email, phone, message.get("subject"))

def send_email(sender_email, sender_password, receiver_email, subject, body, smtp_server="smtp.gmail.com", port=587):
    try:
        # Create the email
        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = receiver_email
        msg["Subject"] = subject

        # Attach the body as plain text
        msg.attach(MIMEText(body, "plain"))

        # Connect to the mail server
        server = smtplib.SMTP(smtp_server, port)
        server.starttls()  # Secure the connection
        server.login(sender_email, sender_password)

        # Send the email
        server.sendmail(sender_email, receiver_email, msg.as_string())
        server.quit()

        print("✅ Email sent successfully!")

    except Exception as e:
        print("❌ Error:", e)

@app.post("/api/cron/weekly-digest")
def cron_weekly_digest(authenticated: bool = Depends(verify_cron_api_key)):
    """
    Send weekly digest of new releases to all users.
    PROTECTED: Requires valid X-API-Key header.
    Only runs on Thursdays (IST).
    """
    # Only act on Thursday IST
    if not _is_thursday_ist_now():
        return {"sent": 0, "skipped": "not Thursday IST"}

    releases = _list_new_releases_for_week()
    if not releases:
        return {"sent": 0}

    # Fetch all profiles with at least one contact method
    params = {"select": "user_id,email,mobile_number"}
    resp = _fetch_supabase("profiles", params=params)
    if resp.status_code not in (200, 206):
        raise HTTPException(status_code=500, detail="Failed to list profiles")

    profiles = [p for p in resp.json() if p.get("email") or p.get("mobile_number")]
    subject = "New releases this week"
    top = releases[:10]
    lines = [f"- {r.get('name') or r.get('original_name') or r.get('title')}" for r in top]
    body = "New and noteworthy releases this week:\n" + "\n".join(lines)

    sent = 0
    for p in profiles:
        try:
            _notify_via_edge(p.get("email"), p.get("mobile_number"), {"subject": subject, "bodyText": body})
            sent += 1
        except Exception as e:
            logger.warning("Weekly digest failed for user %s: %s", p.get("user_id"), e)
            continue

    return {"sent": sent}


# Reminder API endpoints removed for security reasons
# The frontend uses the secure Supabase client directly with proper RLS policies
# These Python endpoints were redundant and created authentication bypass vulnerabilities


@app.post("/api/reminders/send-due")
def send_due_reminders(authenticated: bool = Depends(verify_cron_api_key)):
    """
    Manually trigger sending due reminders.
    PROTECTED: Requires valid X-API-Key header.
    """
    reminders = _list_due_reminders_for_today()  # reusing function to fetch due reminders
    if not reminders:
        return {"sent": 0, "message": "No due reminders"}
    sent = 0
    for rem in reminders:
        user_id = rem.get("user_id")
        profile = rem.get("profiles", {})
        email = profile.get("email")
        phone = profile.get("mobile_number")
        title = rem.get("content_title") or rem.get("content_id")
        release_date = rem.get("release_date")
        message = {
            "subject": f"Reminder: {title} releasing on {release_date}",
            "bodyText": f"Your reminder for '{title}' is due. Release date: {release_date}.
