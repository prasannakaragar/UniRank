from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from models import User

# Role Constants
ROLE_STUDENT = 'student'
ROLE_MENTOR = 'mentor'
ROLE_ADMIN = 'admin'
ROLE_SUPERADMIN = 'superadmin'
ROLE_REVIEWER = 'reviewer'

def roles_required(*roles):
    """
    Decorator to restrict access to specific roles.
    Example: @roles_required('admin', 'mentor')
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user_id = get_jwt_identity()
            user = User.objects(id=user_id).first()
            
            if not user:
                return jsonify({"error": "User not found"}), 404
            
            # Superadmin has master access to everything
            if user.role == ROLE_SUPERADMIN:
                return fn(*args, **kwargs)
                
            if user.role not in roles:
                return jsonify({
                    "error": "Forbidden", 
                    "message": f"This action requires one of the following roles: {', '.join(roles)}"
                }), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def admin_only(fn):
    """Shorthand for @roles_required('admin', 'superadmin')"""
    return roles_required(ROLE_ADMIN, ROLE_SUPERADMIN)(fn)

def mentor_or_admin(fn):
    """Shorthand for @roles_required('mentor', 'admin', 'superadmin')"""
    return roles_required(ROLE_MENTOR, ROLE_ADMIN, ROLE_SUPERADMIN)(fn)

def superadmin_only(fn):
    return roles_required(ROLE_SUPERADMIN)(fn)
