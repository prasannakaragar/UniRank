"""
app.py — UniRank Flask Backend
Entry point. Registers all blueprints and initializes extensions.

Local run : python app.py
Production: gunicorn --worker-class eventlet -w 1 "app:create_app()" --bind 0.0.0.0:$PORT
"""

import os
import socket as _socket

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from dotenv import load_dotenv

from models import db
from routes.auth import auth_bp
from routes.profile import profile_bp
from routes.leaderboard import leaderboard_bp
from routes.announcements import announcements_bp
from routes.teams import teams_bp
from routes.chats import chats_bp
from routes.uploads import uploads_bp
from routes.admin import admin_bp
from routes.hackathons import hackathons_bp
from socket_io import socketio

load_dotenv()


def create_app():
    app = Flask(__name__)

    # ── Configuration ──────────────────────────────────────────────────────
    app.config["SECRET_KEY"]    = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-in-prod")
    app.config["MONGODB_SETTINGS"] = {
        "host": os.getenv("MONGO_URI", "mongodb://localhost:27017/unirank")
    }

    # ── CORS ───────────────────────────────────────────────────────────────
    # FIX: Collect all allowed origins; filter out None values safely.
    # Set FRONTEND_URL env var on Render to your Vercel URL, e.g.:
    #   FRONTEND_URL=https://uni-rank-chi.vercel.app
    _raw_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "").strip(),       # primary production frontend
        os.getenv("FRONTEND_URL_2", "").strip(),     # optional second frontend URL
    ]
    allowed_origins = [o for o in _raw_origins if o]  # drop empty strings / None

    CORS(
        app,
        origins=allowed_origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # ── Extensions ─────────────────────────────────────────────────────────
    db.init_app(app)
    JWTManager(app)

    # ── SocketIO ───────────────────────────────────────────────────────────
    # FIX: pass cors_allowed_origins so Socket.IO connections aren't blocked
    socketio.init_app(
        app,
        cors_allowed_origins=allowed_origins,
        async_mode="eventlet",          # matches gunicorn worker class
    )

    # ── Redis / Cache / Limiter (with in-memory fallback) ──────────────────
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")

    use_redis = bool(os.getenv("REDIS_URL"))  # trust env; don't probe on Render
    if not use_redis:
        # Local dev: probe to see if Redis is actually running
        try:
            _socket.create_connection(("localhost", 6379), timeout=1).close()
            use_redis = True
        except OSError:
            use_redis = False

    if use_redis:
        app.config["CACHE_TYPE"]      = "RedisCache"
        app.config["CACHE_REDIS_URL"] = redis_url
        storage_uri = redis_url
        print(f"INFO: Using Redis cache at {redis_url}")
    else:
        print("WARNING: Redis not available. Falling back to in-memory storage.")
        app.config["CACHE_TYPE"] = "SimpleCache"
        storage_uri = "memory://"

    cache = Cache(app)
    app.cache = cache

    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["1000 per day", "200 per hour"],
        storage_uri=storage_uri,
    )
    app.limiter = limiter

    # ── Blueprints (all under /api prefix) ─────────────────────────────────
    # FIX: Frontend must call  /api/login  NOT  /login
    for bp in [
        auth_bp, profile_bp, leaderboard_bp, announcements_bp,
        teams_bp, chats_bp, uploads_bp, admin_bp, hackathons_bp,
    ]:
        app.register_blueprint(bp, url_prefix="/api")

    # ── Serve uploaded images ───────────────────────────────────────────────
    @app.route("/api/static/uploads/<path:filename>")
    def serve_upload(filename):
        upload_dir = os.path.join(app.root_path, "static", "uploads")
        return send_from_directory(upload_dir, filename)

    # ── Health check (visit /api/health to confirm backend is alive) ────────
    @app.route("/api/health")
    def health():
        return {"status": "ok", "service": "UniRank API"}, 200

    # ── Root route (prevents "Not Found" on bare domain visit) ─────────────
    @app.route("/")
    def index():
        return {"message": "UniRank API is running. Use /api/* endpoints."}, 200

    return app


# ── Local development entry point ──────────────────────────────────────────
if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    socketio.run(app, debug=True, host="0.0.0.0", port=port)