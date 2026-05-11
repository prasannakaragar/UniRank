"""
app.py — UniRank Flask Backend
Entry point. Registers all blueprints and initializes extensions.
Run: python app.py
"""
import os
from flask import Flask
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
from socket_io import socketio

load_dotenv()


def create_app():
    app = Flask(__name__)

    # ── Configuration ──────────────────────────────────────────────────────
    app.config["SECRET_KEY"]             = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
    app.config["JWT_SECRET_KEY"]         = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-in-prod")
    app.config["MONGODB_SETTINGS"] = {
        "host": os.getenv("MONGO_URI", "mongodb://localhost:27017/unirank")
    }

    # ── Extensions ─────────────────────────────────────────────────────────
    db.init_app(app)
    JWTManager(app)
    CORS(app, origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"])
    
    # Initialize SocketIO
    socketio.init_app(app)

    # Initialize Caching & Limiter with Fallback
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Check if we should use Redis or fallback to memory
    # In a real prod environment, you'd want this to fail, but for dev we allow fallback
    use_redis = True
    if os.getenv("FLASK_ENV") != "production":
        import socket
        try:
            # Quick check if redis is reachable
            socket.create_connection(("localhost", 6379), timeout=1)
        except:
            use_redis = False

    if use_redis:
        app.config["CACHE_TYPE"] = "RedisCache"
        app.config["CACHE_REDIS_URL"] = redis_url
        storage_uri = redis_url
    else:
        print("⚠️  Redis not found at localhost:6379. Falling back to in-memory storage.")
        app.config["CACHE_TYPE"] = "SimpleCache"
        storage_uri = "memory://"

    cache = Cache(app)
    app.cache = cache

    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["1000 per day", "200 per hour"],
        storage_uri=storage_uri
    )
    app.limiter = limiter

    # ── Blueprints (all under /api prefix) ─────────────────────────────────
    for bp in [auth_bp, profile_bp, leaderboard_bp, announcements_bp, teams_bp, chats_bp]:
        app.register_blueprint(bp, url_prefix="/api")

    # ── Health check ───────────────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return {"status": "ok", "service": "UniRank API"}, 200

    return app


if __name__ == "__main__":
    app = create_app()
    # Use socketio.run instead of app.run for real-time support
    socketio.run(app, debug=True, port=5000)
