"""
routes/uploads.py
Simple image upload endpoint — saves to static/uploads, returns public URL.
"""
import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

uploads_bp = Blueprint("uploads", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "svg"}
MAX_SIZE_MB = 5


def _allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@uploads_bp.route("/upload/image", methods=["POST"])
@jwt_required()
def upload_image():
    """
    POST /api/upload/image
    multipart/form-data with field: file
    Returns: { "url": "/api/static/uploads/<filename>" }
    """
    if "file" not in request.files:
        return jsonify({"error": "No file field"}), 400

    f = request.files["file"]

    if f.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not _allowed(f.filename):
        return jsonify({"error": f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    # Check size
    f.seek(0, 2)
    size_mb = f.tell() / (1024 * 1024)
    f.seek(0)
    if size_mb > MAX_SIZE_MB:
        return jsonify({"error": f"File too large (max {MAX_SIZE_MB} MB)"}), 400

    ext = f.filename.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"

    upload_dir = os.path.join(current_app.root_path, "static", "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    save_path = os.path.join(upload_dir, unique_name)
    f.save(save_path)

    url = f"/api/static/uploads/{unique_name}"
    return jsonify({"url": url}), 201
