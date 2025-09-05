import os
from datetime import date
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
from dotenv import load_dotenv

load_dotenv()

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

@app.get("/api/upcoming-shows")
def upcoming_shows(page: int = Query(1, ge=1), language: str = "en-US"):
    today = date.today().isoformat()
    url = f"{TMDB_BASE}/discover/tv"
    params = {
        "language": language,
        "sort_by": "first_air_date.asc",
        "first_air_date.gte": today,
        "page": page,
    }
    headers = {"Authorization": f"Bearer {TMDB_TOKEN}"}
    try:
        r = requests.get(url, headers=headers, params=params, timeout=10)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()