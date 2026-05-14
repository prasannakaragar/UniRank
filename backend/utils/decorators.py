from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models import User

def role_required(*allowed_roles):
    """
    Decorator to restrict access based on user roles.
    Must be used AFTER @jwt_required() or it will verify JWT itself.
    """
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.objects(id=user_id).first()

            if not user:
                return jsonify({"error": "User not found"}), 404

            # Master admin has access to everything
            if user.role == "admin":
                return fn(*args, **kwargs)

            # Check if user role is in the allowed roles
            if user.role not in allowed_roles:
                return jsonify({
                    "error": "Forbidden: You do not have the required role to access this resource",
                    "required_roles": allowed_roles,
                    "your_role": user.role
                }), 403

            return fn(*args, **kwargs)
        return decorator
    return wrapper
