from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Profile, HackathonResult, Announcement, TeamPost
from utils.scoring import update_user_scores
from utils.auth_middleware import admin_only, mentor_or_admin

admin_bp = Blueprint("admin", __name__)

@admin_bp.route("/admin/stats", methods=["GET"])
@jwt_required()
@mentor_or_admin
def get_stats():
    stats = {
        "total_users": User.objects().count(),
        "total_announcements": Announcement.objects().count(),
        "total_teams": TeamPost.objects().count(),
        "total_hackathon_results": HackathonResult.objects().count(),
    }
    return jsonify(stats), 200

@admin_bp.route("/admin/users", methods=["GET"])
@jwt_required()
@admin_only
def get_users():
    current_uid = get_jwt_identity()
    current_user = User.objects(id=current_uid).first()
    
    if current_user.role == 'superadmin':
        users = User.objects().order_by('-created_at')
    else:
        domain = current_user.email.split("@")[1]
        users = User.objects(email__endswith=f"@{domain}").order_by('-created_at')
        
    user_list = []
    for u in users:
        profile = Profile.objects(user=u).first()
        user_list.append({
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "branch": u.branch,
            "year": u.year,
            "college": u.college,
            "global_score": profile.global_score if profile else 0
        })
    return jsonify({"users": user_list}), 200

@admin_bp.route("/admin/user/<uid>/role", methods=["POST"])
@jwt_required()
@admin_only
def change_role(uid):
    current_uid = get_jwt_identity()
    current_user = User.objects(id=current_uid).first()
    
    data = request.get_json()
    new_role = data.get("role")
    if new_role not in ['student', 'mentor', 'admin', 'reviewer', 'superadmin']:
        return jsonify({"error": "Invalid role"}), 400
        
    user = User.objects(id=uid).first_or_404()
    
    current_domain = current_user.email.split("@")[1]
    target_domain = user.email.split("@")[1]
    if current_user.role != 'superadmin' and target_domain != current_domain:
        return jsonify({"error": "Cannot change role of user from different college"}), 403
    if new_role == 'superadmin' and current_user.role != 'superadmin':
        return jsonify({"error": "Only superadmin can grant superadmin role"}), 403
        
    user.role = new_role
    user.save()
    return jsonify({"message": f"User role updated to {new_role}"}), 200

@admin_bp.route("/admin/user/<uid>", methods=["DELETE"])
@jwt_required()
@admin_only
def delete_user(uid):
    current_uid = get_jwt_identity()
    current_user = User.objects(id=current_uid).first()
    user = User.objects(id=uid).first_or_404()
    
    current_domain = current_user.email.split("@")[1]
    target_domain = user.email.split("@")[1]
    if current_user.role != 'superadmin' and target_domain != current_domain:
        return jsonify({"error": "Cannot delete user from different college"}), 403
        
    user.delete()
    return jsonify({"message": "User deleted successfully"}), 200

@admin_bp.route("/admin/recalculate", methods=["POST"])
@jwt_required()
@admin_only
def recalculate_all():
    current_uid = get_jwt_identity()
    current_user = User.objects(id=current_uid).first()
    
    if current_user.role == 'superadmin':
        users = User.objects()
    else:
        domain = current_user.email.split("@")[1]
        users = User.objects(email__endswith=f"@{domain}")
        
    for u in users:
        update_user_scores(str(u.id))
        
    return jsonify({"message": f"Successfully recalculated scores for {len(users)} users"}), 200

@admin_bp.route("/admin/user/<uid>/score", methods=["POST"])
@jwt_required()
@admin_only
def adjust_score(uid):
    data = request.get_json()
    points = data.get("points", 0)
    reason = data.get("reason", "Admin adjustment")
    
    profile = Profile.objects(user=uid).first_or_404()
    profile.activity_score += int(points) # Adjusting activity score as it's the safest component to manual edit
    profile.save()
    
    update_user_scores(uid)
    return jsonify({"message": f"Added {points} points to user", "new_score": profile.global_score}), 200
