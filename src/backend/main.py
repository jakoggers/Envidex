"""
Envidex prediction service — single FastAPI entrypoint.

Start without Gemini:
  cd src/backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000

/predict is the product inference path. Optional /api/animal-info requires GEMINI_API_KEY.
Prediction.py under AnimalAiImageRec is retired as a second server.
"""

from __future__ import annotations

import io
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import numpy as np
import tensorflow as tf
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(PROJECT_ROOT / "animal_species_model.keras")))
CLASS_NAMES_PATH = Path(os.getenv("CLASS_NAMES_PATH", str(PROJECT_ROOT / "class_names.json")))
MODEL_VERSION = os.getenv("MODEL_VERSION", MODEL_PATH.name)
IMG_SIZE = (224, 224)
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

model = None
class_names: list[str] = []

if MODEL_PATH.exists() and CLASS_NAMES_PATH.exists():
    model = tf.keras.models.load_model(str(MODEL_PATH))
    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        class_names = json.load(f)
else:
    print(f"WARNING: Model files not found at {MODEL_PATH} / {CLASS_NAMES_PATH}")

SCIENTIFIC_NAMES = {
    "ochotona_princeps": "Ochotona princeps",
    "panthera_leo": "Panthera leo",
    "panthera_tigris": "Panthera tigris",
}


def label_to_common_name(label: str) -> str:
    return label.replace("_", " ").title()


def label_to_scientific_name(label: str) -> str:
    if label in SCIENTIFIC_NAMES:
        return SCIENTIFIC_NAMES[label]
    parts = label.split("_")
    if len(parts) >= 2:
        return f"{parts[0].capitalize()} {' '.join(parts[1:])}"
    return label.replace("_", " ").title()


def predict_pil_image(img: Image.Image) -> dict[str, Any]:
    if model is None or not class_names:
        raise RuntimeError("Model not loaded")

    rgb = img.convert("RGB").resize(IMG_SIZE)
    arr = np.array(rgb, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)

    preds = model.predict(arr, verbose=0)
    pred_index = int(np.argmax(preds[0]))
    score = float(preds[0][pred_index])
    label = class_names[pred_index]

    return {
        "label": label,
        "common_name": label_to_common_name(label),
        "scientific_name": label_to_scientific_name(label),
        # Raw model softmax score in [0, 1] — not a calibrated percentage.
        "score": round(score, 6),
        "model_version": MODEL_VERSION,
        "source": "local-keras",
    }


app = FastAPI(title="Envidex Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model_loaded": model is not None,
        "model_version": MODEL_VERSION if model is not None else None,
        "class_count": len(class_names),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")

    try:
        img = Image.open(io.BytesIO(contents))
        img.load()
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Invalid image") from exc
    except OSError as exc:
        raise HTTPException(status_code=400, detail="Invalid image") from exc

    try:
        return predict_pil_image(img)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Prediction failed") from exc


class AnimalRequest(BaseModel):
    detected_name: str = Field(..., description="Animal name from detector output")
    confidence: Optional[float] = Field(None, description="Optional detector confidence")
    scientific_name: Optional[str] = Field(
        None, description="Optional scientific name if detector provides it"
    )


class AnimalInfo(BaseModel):
    common_name: str
    scientific_name: str
    description: str
    endangerment_status: str
    donation_link: Optional[str] = None


DONATION_LINKS = {
    "snow leopard": "https://snowleopard.org/",
    "african elephant": "https://www.savetheelephants.org/",
    "pangolin": "https://www.pangolincrisisfund.org/",
    "sea otter": "https://www.seaotter.org/",
}


def inject_trusted_donation_link(info: AnimalInfo) -> AnimalInfo:
    key = info.common_name.strip().lower()
    trusted_link = DONATION_LINKS.get(key)
    if trusted_link:
        info.donation_link = trusted_link
    return info


def _gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    from google import genai

    return genai.Client(api_key=api_key)


def _optional_logs_collection():
    mongo_uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI_REAL")
    if not mongo_uri:
        return None
    from pymongo import MongoClient

    client = MongoClient(mongo_uri)
    return client.envidex.animal_logs


@app.post("/api/animal-info", response_model=AnimalInfo)
def get_animal_info(payload: AnimalRequest) -> AnimalInfo:
    gemini = _gemini_client()
    if gemini is None:
        raise HTTPException(
            status_code=503,
            detail="Animal info unavailable: GEMINI_API_KEY is not configured",
        )

    from google.genai import types

    detected = payload.detected_name.strip()
    if not detected:
        raise HTTPException(status_code=400, detail="detected_name is required")

    prompt = f"""
You are helping a wildlife webapp.

Given an animal detector output, return structured data.

Detector output: {detected}
Confidence: {payload.confidence}
Scientific name: {payload.scientific_name}

Instructions:
- Return the most likely common animal name.
- Return the scientific name
- Write a short factual description under 80 words.
- Return a concise conservation/endangerment status.
- donation_link must be null unless you are highly confident in an official or well-known conservation donation page.
- If the detector output is uncertain, be conservative and reflect uncertainty briefly in the description.
- Never invent population counts or citations you do not know.
"""

    try:
        response = gemini.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AnimalInfo,
                temperature=0.2,
            ),
        )
        parsed = response.parsed
        if parsed is None:
            raise ValueError("Gemini returned no parsed JSON")

        result = inject_trusted_donation_link(parsed)
        logs = _optional_logs_collection()
        if logs is not None:
            logs.insert_one(
                {
                    "detected_name": payload.detected_name,
                    "scientific_name": result.scientific_name,
                    "common_name": result.common_name,
                    "confidence": payload.confidence,
                    "timestamp": datetime.utcnow(),
                    "user_id": None,
                }
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Gemini request failed") from exc
