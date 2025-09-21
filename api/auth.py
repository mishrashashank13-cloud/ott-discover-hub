from fastapi import APIRouter, HTTPException, Body
import random
import string

router = APIRouter()

# In-memory store for OTP codes: {identifier: otp}
otp_store = {}

def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))

@router.post("/signup")
def signup(identifier: str = Body(..., embed=True)):
    """
    Signup using email or phone.
    This simulates generating and sending an OTP.
    """
    otp = generate_otp()
    otp_store[identifier] = otp
    # In a real implementation, send OTP via email/SMS.
    return {"message": f"OTP sent to {identifier}", "otp": otp}  # expose OTP for testing

@router.post("/verify")
def verify(identifier: str = Body(..., embed=True), otp: str = Body(..., embed=True)):
    """
    Verify OTP for email/phone.
    """
    stored = otp_store.get(identifier)
    if not stored:
        raise HTTPException(status_code=400, detail="No OTP generated for this identifier.")
    if otp != stored:
        raise HTTPException(status_code=400, detail="Invalid OTP.")
    # For testing, return a dummy token.
    del otp_store[identifier]
    return {"message": "Verification successful", "token": "test-token-123"}

@router.post("/social-login")
def social_login(provider: str = Body(..., embed=True), token: str = Body(..., embed=True)):
    """
    Simulate social login.
    Accepts provider (google or apple) and token; returns a dummy session token.
    """
    allowed = {"google", "apple"}
    if provider.lower() not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported provider.")
    # Normally verify the token with the provider.
    return {"message": f"Social login successful with {provider}", "token": f"{provider}-session-token"}

@router.post("/gdpr-delete")
def gdpr_delete(user_id: str = Body(..., embed=True)):
    """
    GDPR deletion endpoint.
    In a real system, this would delete all identifiable data.
    """
    # For testing, we just log the deletion request.
    print(f"Deleting user data for user_id: {user_id}")
    return {"message": f"User data for {user_id} scheduled for deletion."}