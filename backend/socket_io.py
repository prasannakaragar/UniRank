from flask_socketio import SocketIO
import os

# Initialize SocketIO without an app first
# message_queue is set to Redis for horizontal scalability
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")

# Check if Redis is reachable before setting message_queue
use_redis = True
import socket
try:
    socket.create_connection(("localhost", 6379), timeout=1)
except:
    use_redis = False

if use_redis:
    socketio = SocketIO(cors_allowed_origins="*", message_queue=redis_url)
else:
    socketio = SocketIO(cors_allowed_origins="*")
