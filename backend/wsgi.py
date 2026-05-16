# ── Flask 3.x compatibility patch for flask-mongoengine 1.0.0 ──
# flask-mongoengine 1.0.0 has two incompatibilities with Flask 2.3+/3.x:
#   1. Imports JSONEncoder/JSONDecoder from flask.json (removed in Flask 2.3)
#   2. Calls app.json_encoder = ... (also removed in Flask 2.3)
# Fix #1: inject JSONEncoder/JSONDecoder back into flask.json
import json
import flask.json
if not hasattr(flask.json, 'JSONEncoder'):
    flask.json.JSONEncoder = json.JSONEncoder
if not hasattr(flask.json, 'JSONDecoder'):
    flask.json.JSONDecoder = json.JSONDecoder

# Fix #2: neutralize override_json_encoder — must import the module first
# (the import itself is now safe because JSONEncoder exists in flask.json)
import flask_mongoengine.json as _fme_json
_fme_json.override_json_encoder = lambda app: None

from app import create_app
from socket_io import socketio

app = create_app()

if __name__ == "__main__":
    socketio.run(app)
