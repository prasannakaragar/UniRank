"""
utils/rate_limiter.py
Simple in-memory rate limiter (no external dependencies).
Tracks request counts per IP+endpoint with a sliding window.
"""
import time
from functools import wraps
from flask import request, jsonify

# { "ip:endpoint": [timestamp, timestamp, ...] }
_request_log = {}


def rate_limit(max_requests=5, window_seconds=300):
    """
    Decorator to limit requests per IP per endpoint.
    Default: 5 requests per 5 minutes.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Get real IP if behind a proxy (like Nginx, Render, Railway)
            if request.headers.getlist("X-Forwarded-For"):
                ip = request.headers.getlist("X-Forwarded-For")[0].split(',')[0].strip()
            else:
                ip = request.remote_addr or "unknown"
            
            key = f"{ip}:{request.endpoint}"
            now = time.time()

            # Initialise or prune old entries
            if key not in _request_log:
                _request_log[key] = []

            _request_log[key] = [
                ts for ts in _request_log[key]
                if now - ts < window_seconds
            ]

            if len(_request_log[key]) >= max_requests:
                return jsonify({
                    "error": "Too many requests. Please try again later."
                }), 429

            _request_log[key].append(now)
            return f(*args, **kwargs)
        return wrapper
    return decorator
