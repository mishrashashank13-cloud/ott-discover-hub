import os
import logging
import time
from datetime import date
from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

TMDB_TOKEN = os.getenv("TMDB_ACCESS_TOKEN")
if not TMDB_TOKEN:
    raise RuntimeError("TMDB_ACCESS_TOKEN environment variable is not set")

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
    headers = {"Authorization": f"Bearer {TMDB_TOKEN}"}

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
            params={"watch_region": "IN"},
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
