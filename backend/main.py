"""
HueMind — Emotion Detection API
FastAPI backend that serves predictions from a fine-tuned DistilBERT model.
"""

import os
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Dict

import torch
import torch.nn.functional as F
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("huemind")

# ── Model path ────────────────────────────────────────────────────────────────
# By default, look one directory up (the project root) for the model files.
MODEL_DIR = Path(os.getenv("MODEL_DIR", Path(__file__).parent.parent))

LABEL_MAP: Dict[int, str] = {
    0: "sadness",
    1: "joy",
    2: "love",
    3: "anger",
    4: "fear",
    5: "surprise",
}

MAX_TOKENS = 512
MAX_CHARS  = 2000   # soft guard on raw input length

# Global holders — populated during startup
tokenizer = None
model     = None
device    = torch.device("cpu")


# ── Lifespan: load model once at startup ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer, model
    log.info("Loading tokenizer from %s …", MODEL_DIR)
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))

    log.info("Loading model from %s …", MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    model.to(device)
    model.eval()
    log.info("Model loaded — ready to serve predictions.")
    yield
    log.info("Shutting down.")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="HueMind Emotion Detection API",
    description="Classify text into one of six emotions using fine-tuned DistilBERT.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the local dev frontend and any future Vercel deployment.
# Update ALLOWED_ORIGINS via env var in production.
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = (
    [o.strip() for o in _origins_env.split(",") if o.strip()]
    if _origins_env
    else ["http://localhost:3000", "http://127.0.0.1:3000",
          "http://localhost:5500", "http://127.0.0.1:5500",
          "http://localhost:8080", "http://127.0.0.1:8080",
          "null"]          # file:// origin sent by browsers as "null"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",   # any Vercel preview
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_must_not_be_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("text must not be empty or whitespace")
        if len(stripped) > MAX_CHARS:
            raise ValueError(f"text must be ≤ {MAX_CHARS} characters")
        return stripped


class EmotionScore(BaseModel):
    label: str
    probability: float


class PredictResponse(BaseModel):
    predicted_emotion: str
    confidence: float
    probabilities: Dict[str, float]


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health", tags=["infra"])
def health_check():
    """Quick liveness probe."""
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "device": str(device),
    }


@app.post("/predict", response_model=PredictResponse, tags=["inference"])
def predict(req: PredictRequest) -> PredictResponse:
    """Run emotion classification on the supplied text."""
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    try:
        inputs = tokenizer(
            req.text,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_TOKENS,
            padding=True,
        )
        # DistilBERT does not accept token_type_ids — drop it if present
        inputs.pop("token_type_ids", None)
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)

        logits = outputs.logits.squeeze(0)           # shape: (num_labels,)
        probs  = F.softmax(logits, dim=-1).tolist()  # list of 6 floats

        pred_idx  = int(torch.argmax(logits).item())
        pred_label = LABEL_MAP[pred_idx]
        confidence = round(probs[pred_idx] * 100, 2)

        prob_dict = {LABEL_MAP[i]: round(p * 100, 2) for i, p in enumerate(probs)}

        log.info("text=%.60s… → %s (%.1f%%)", req.text, pred_label, confidence)

        return PredictResponse(
            predicted_emotion=pred_label,
            confidence=confidence,
            probabilities=prob_dict,
        )

    except Exception as exc:
        log.exception("Inference error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc


# ── Dev entry-point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
