# eventlet.monkey_patch() MUST be first — before Flask, Werkzeug, or any other import.
# gunicorn's eventlet worker calls it too late (after app is loaded), causing
# "weakly-referenced object no longer exists" and context errors.
import eventlet
eventlet.monkey_patch()

from app import create_app
from socket_io import socketio

app = create_app()

if __name__ == "__main__":
    socketio.run(app)

