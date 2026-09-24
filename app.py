import base64
import io
import os
from pathlib import Path

import numpy as np
from flask import Flask, abort, jsonify, request, send_from_directory
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
CNN_MODEL_PATH = BASE_DIR / "models" / "mishra" / "driver_behavior_cnn.h5"
IS_VERCEL = os.getenv("VERCEL") == "1"
CNN_CLASSES = [
    "Smoking/Drinking/Yawning",
    "safe_driving",
    "talking_phone",
    "texting_phone",
    "turning",
]
cnn_model = None

app = Flask(
    __name__,
    static_folder=str(PUBLIC_DIR / "static"),
    static_url_path="/static",
)


def is_local_request():
    host = request.host.split(":", 1)[0].lower()
    return host in {"localhost", "127.0.0.1", "::1"}


def is_cnn_enabled():
    if not CNN_MODEL_PATH.exists():
        return False

    return not IS_VERCEL or is_local_request()


def cnn_disabled_reason():
    if not CNN_MODEL_PATH.exists():
        return f"CNN model file not found at {CNN_MODEL_PATH}"

    if IS_VERCEL and not is_local_request():
        return "CNN is disabled because VERCEL=1"

    return ""


def load_cnn_model():
    global cnn_model

    if not is_cnn_enabled():
        return None

    if cnn_model is None:
        from tensorflow.keras.models import load_model

        cnn_model = load_model(CNN_MODEL_PATH, compile=False)

    return cnn_model


def decode_data_url(data_url):
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]

    image_bytes = base64.b64decode(data_url)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return image


def predict_cnn(data_url):
    model = load_cnn_model()
    if model is None:
        abort(404)

    image = decode_data_url(data_url)
    image = image.resize((128, 128))
    image_array = np.asarray(image, dtype=np.float32) / 255.0
    image_array = np.expand_dims(image_array, axis=0)

    predictions = model.predict(image_array, verbose=0)
    predicted_class_idx = int(np.argmax(predictions[0]))

    return {
        "class": CNN_CLASSES[predicted_class_idx],
        "confidence": float(predictions[0][predicted_class_idx]),
    }


@app.route("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.route("/api/runtime-config")
def runtime_config():
    return jsonify({
        "cnn_enabled": is_cnn_enabled(),
        "cnn_reason": cnn_disabled_reason(),
        "is_vercel": IS_VERCEL,
        "cnn_model_path": str(CNN_MODEL_PATH),
    })


@app.route("/api/cnn", methods=["POST"])
def cnn_prediction():
    if not is_cnn_enabled():
        return jsonify({"error": cnn_disabled_reason()}), 404

    payload = request.get_json(silent=True) or {}
    data_url = payload.get("image")

    if not data_url:
        return jsonify({"error": "Missing image data"}), 400

    return jsonify(predict_cnn(data_url))


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(PUBLIC_DIR, "favicon.ico")


@app.route("/<path:path>")
def public_file(path):
    requested_path = PUBLIC_DIR / path

    if requested_path.is_file():
        return send_from_directory(PUBLIC_DIR, path)

    abort(404)


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, host="0.0.0.0", port=5000)
