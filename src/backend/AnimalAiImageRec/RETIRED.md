# Retired second server

`Prediction.py` previously exposed a second FastAPI app with a different `/predict`
response shape (`{ result, saved_to }`) and wrote a shared `prediction.json`.

**Use `src/backend/main.py` only.** Do not start `Prediction.py` alongside the product.
