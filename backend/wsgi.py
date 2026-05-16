# ── Flask 3.x compatibility patch for flask-mongoengine 1.0.0 ──
# flask-mongoengine tries to import JSONEncoder/JSONDecoder from flask.json,
# which were removed in Flask 2.3+. Patch BEFORE any other imports.
import json
import flask.json
if not hasattr(flask.json, 'JSONEncoder'):
    flask.json.JSONEncoder = json.JSONEncoder
if not hasattr(flask.json, 'JSONDecoder'):
    flask.json.JSONDecoder = json.JSONDecoder

from app import create_app
from socket_io import socketio

app = create_app()

if __name__ == "__main__":
    socketio.run(app)
