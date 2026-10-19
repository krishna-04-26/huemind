# HueMind — Emotion Detection from Text

> *Every sentence has a shade.*

HueMind is an atmospheric web application that classifies text into one of **six emotions** — sadness, joy, love, anger, fear, or surprise — using a fine-tuned **DistilBERT** model.

---

## Project Structure

```
Emotion Detector/
├── config.json               # Model config (DistilBERT + label map)
├── model.safetensors         # Fine-tuned weights (~256 MB)
├── tokenizer.json            # Tokenizer vocabulary
├── tokenizer_config.json     # Tokenizer settings
├── training_args.bin         # Training hyperparameters
│
├── backend/
│   ├── main.py               # FastAPI app (loads model, /predict, /health)
│   └── requirements.txt      # Python dependencies
│
├── frontend/
│   ├── index.html            # Single-page app
│   ├── style.css             # Atmospheric dark UI with emotion palettes
│   └── app.js                # Canvas background, API calls, Chart.js charts
│
└── README.md
```

---

## Quick Start

### 1 — Install Python dependencies

```powershell
cd "Emotion Detector/backend"
pip install -r requirements.txt
```

### 2 — Start the API server

```powershell
# From the backend/ directory:
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://127.0.0.1:8000`.
Health check: `http://127.0.0.1:8000/health`
Interactive docs: `http://127.0.0.1:8000/docs`

### 3 — Open the frontend

Open `frontend/index.html` in your browser (double-click, or use a local server):

```powershell
# Simple local server via Python (optional, avoids file:// CORS nuances)
cd frontend
python -m http.server 5500
# then visit http://localhost:5500
```

---

## API Reference

### `GET /health`
Returns `{ "status": "ok", "model_loaded": true, "device": "cpu" }`.

### `POST /predict`
**Request body:**
```json
{ "text": "I feel absolutely wonderful today!" }
```
**Response:**
```json
{
  "predicted_emotion": "joy",
  "confidence": 97.43,
  "probabilities": {
    "sadness": 0.12,
    "joy": 97.43,
    "love": 1.89,
    "anger": 0.21,
    "fear": 0.14,
    "surprise": 0.21
  }
}
```

---

## Model Details

| Property | Value |
|---|---|
| Base model | `distilbert/distilbert-base-uncased` |
| Parameters | ~66M |
| Task | 6-class sequence classification |
| Dataset | DAIR.AI Emotion (Twitter) |
| Training split | 16,000 examples |
| Validation split | 2,000 examples |
| Test split | 2,000 examples |
| Epochs | 3 |
| Test Accuracy | **92.70%** |
| Test Macro-F1 | **87.76%** |

### Training history

| Epoch | Val Accuracy | Val Macro-F1 |
|---|---:|---:|
| 1 | 93.00% | 90.40% |
| 2 | 93.80% | 91.02% |
| 3 | 94.30% | 92.13% |

---

## Deployment

### Backend (Python API)

Recommended free Python hosting options:
- **Render** — Push to GitHub, create a new Web Service, set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Railway** — Similar Docker-free deploy
- **Fly.io** — Via `fly launch`

Set the environment variable `MODEL_DIR` to the path containing your model files, or mount them into the container.

### Frontend (Vercel / Netlify)

1. Update `API_BASE` in `frontend/app.js` to your deployed API URL.
2. Deploy the `frontend/` directory to Vercel or Netlify.

```js
// app.js, top of file — update this line:
const API_BASE = "https://your-api.onrender.com";
```

### CORS

The backend already allows `https://*.vercel.app` origins via regex. Set the `ALLOWED_ORIGINS` environment variable for additional domains:

```
ALLOWED_ORIGINS=https://your-site.vercel.app,https://yourdomain.com
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Model | DistilBERT (HuggingFace Transformers) |
| Backend | FastAPI + Uvicorn |
| Frontend | HTML / Vanilla CSS / JavaScript |
| Charts | Chart.js 4 |
| Fonts | Google Fonts — Inter, DM Serif Display |

---

*Built with PyTorch · DAIR.AI Emotion Dataset · FastAPI · Chart.js*
