from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Profile, HackathonResult, Announcement, TeamPost, Issue, AdminLog, College
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
        "total_hackathon_results": Announcement.objects(category="hackathon").count(),
    }
    return jsonify(stats), 200

@admin_bp.route("/admin/users", methods=["GET"])
@jwt_required()
@admin_only
def get_users():
    users = User.objects().order_by('-created_at')
        
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
            "global_score": profile.global_score if profile else 0,
            "cf_handle": profile.cf_handle if profile else "",
            "lc_username": profile.lc_username if profile else "",
            "github_url": profile.github_url if profile else ""
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

# -----------------------------------------
# NEW ADMIN SYSTEM ENDPOINTS
# -----------------------------------------

@admin_bp.route("/admin/dashboard", methods=["GET"])
@jwt_required()
@admin_only
def get_dashboard():
    total_students = User.objects(role="student").count()
    total_colleges = College.objects().count()
    
    # Top 10 leaderboard (global_score descending)
    top_profiles = Profile.objects().order_by("-global_score").limit(10)
    top_10 = []
    for p in top_profiles:
        top_10.append({
            "id": str(p.user.id),
            "name": p.user.name,
            "college": p.user.college,
            "global_score": p.global_score
        })
        
    recent_issues = [i.to_dict() for i in Issue.objects().order_by("-created_at").limit(5)]
    
    return jsonify({
        "total_students": total_students,
        "total_colleges": total_colleges,
        "top_10_leaderboard": top_10,
        "recent_issues": recent_issues
    }), 200

@admin_bp.route("/admin/colleges/search", methods=["GET"])
@jwt_required()
@admin_only
def search_colleges():
    q = request.args.get("q", "")
    if not q:
        # Instant suggestion: top 10 colleges alphabetically
        colleges = College.objects().order_by('name').limit(10)
    else:
        # Filtered suggestions: matching name case-insensitively, sorted alphabetically, limit 10
        colleges = College.objects(name__icontains=q).order_by('name').limit(10)
        
    return jsonify({"colleges": [c.to_dict() for c in colleges]}), 200

@admin_bp.route("/admin/students", methods=["GET"])
@jwt_required()
@admin_only
def get_students_by_college():
    college = request.args.get("college", "")
    if not college:
        return jsonify({"error": "College parameter is required"}), 400
        
    users = User.objects(role="student", college__iexact=college)
    students = []
    for u in users:
        p = Profile.objects(user=u).first()
        students.append({
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "branch": u.branch,
            "year": u.year,
            "score": p.global_score if p else 0,
            "cf_handle": p.cf_handle if p else "",
            "lc_username": p.lc_username if p else "",
            "github_url": p.github_url if p else "",
            "updatedAt": p.last_synced.isoformat() if p and p.last_synced else u.created_at.isoformat()
        })
    return jsonify({"students": students}), 200

@admin_bp.route("/admin/student/<user_id>", methods=["PUT"])
@jwt_required()
@admin_only
def edit_student(user_id):
    current_uid = get_jwt_identity()
    current_admin = User.objects(id=current_uid).first()
    
    data = request.get_json()
    user = User.objects(id=user_id).first()
    if not user:
        return jsonify({"error": "Student not found"}), 404
        
    profile = Profile.objects(user=user).first()
    if not profile:
        return jsonify({"error": "Profile not found"}), 404
        
    import datetime
    from utils.codeforces import sync_user_stats
    from utils.leetcode import sync_leetcode_stats

    if "github_url" in data:
        profile.github_url = data["github_url"]
        if not data["github_url"]:
            profile.github_impl_score = 0.0
            profile.github_imp_score = 0.0
            profile.github_work_score = 0.0
            profile.github_total_score = 0.0
            profile.github_review_reason = ""

    if "lc_username" in data:
        profile.lc_username = data["lc_username"]
        if data["lc_username"]:
            stats = sync_leetcode_stats(data["lc_username"])
            if stats:
                profile.lc_rating          = stats.get("lc_rating", 0)
                profile.lc_max_rating      = stats.get("lc_max_rating", 0)
                profile.lc_rank            = stats.get("lc_rank", 0)
                profile.lc_problems_solved = stats.get("lc_problems_solved", 0)
        else:
            profile.lc_rating          = 0
            profile.lc_max_rating      = 0
            profile.lc_rank            = 0
            profile.lc_problems_solved = 0

    if "cf_handle" in data:
        profile.cf_handle = data["cf_handle"]
        if data["cf_handle"]:
            stats = sync_user_stats(data["cf_handle"])
            profile.cf_rating          = stats.get("cf_rating", 0)
            profile.cf_max_rating      = stats.get("cf_max_rating", 0)
            profile.cf_rank            = stats.get("cf_rank", "unrated")
            profile.cf_problems_solved = stats.get("cf_problems_solved", 0)
            profile.avatar_url         = stats.get("avatar_url")
        else:
            profile.cf_rating          = 0
            profile.cf_max_rating      = 0
            profile.cf_rank            = "unrated"
            profile.cf_problems_solved = 0
            profile.avatar_url         = None
        
    profile.last_synced = datetime.datetime.utcnow()
    profile.save()
    
    # Recalculate leaderboard scores immediately
    update_user_scores(str(user.id))
    
    # Log action
    AdminLog(
        admin_id=current_admin,
        action="EDIT_STUDENT",
        target_user_id=str(user.id),
        details=f"Updated handles for {user.name}"
    ).save()
    
    return jsonify({"message": "Student updated successfully", "student": profile.to_dict()}), 200

@admin_bp.route("/admin/student/<user_id>/score", methods=["PUT"])
@jwt_required()
@admin_only
def modify_student_score(user_id):
    current_uid = get_jwt_identity()
    current_admin = User.objects(id=current_uid).first()
    
    data = request.get_json()
    score = data.get("score")
    if score is None:
        return jsonify({"error": "Score is required"}), 400
        
    profile = Profile.objects(user=user_id).first()
    if not profile:
        return jsonify({"error": "Profile not found"}), 404
        
    profile.activity_score = int(score)
    profile.save()
    
    update_user_scores(user_id)
    profile.reload()
    
    # Log action
    AdminLog(
        admin_id=current_admin,
        action="MODIFY_SCORE",
        target_user_id=str(user_id),
        details=f"Modified score to {score}"
    ).save()
    
    return jsonify({"message": "Score updated successfully", "new_score": profile.global_score}), 200

@admin_bp.route("/admin/issues", methods=["GET"])
@jwt_required()
@admin_only
def get_issues():
    issues = Issue.objects().order_by("-created_at")
    return jsonify({"issues": [i.to_dict() for i in issues]}), 200

@admin_bp.route("/admin/issues/<issue_id>/resolve", methods=["PUT"])
@jwt_required()
@admin_only
def resolve_issue(issue_id):
    current_uid = get_jwt_identity()
    current_admin = User.objects(id=current_uid).first()
    
    issue = Issue.objects(id=issue_id).first()
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    issue.status = "resolved"
    import datetime
    issue.resolved_at = datetime.datetime.utcnow()
    issue.save()
    
    # Log action
    AdminLog(
        admin_id=current_admin,
        action="RESOLVE_ISSUE",
        target_user_id=str(issue.reported_by.id) if issue.reported_by else "",
        details=f"Resolved issue: {issue.title}"
    ).save()
    
    return jsonify({"message": "Issue resolved successfully", "issue": issue.to_dict()}), 200

@admin_bp.route("/admin/logs", methods=["GET"])
@jwt_required()
@admin_only
def get_admin_logs():
    logs = AdminLog.objects().order_by("-timestamp")
    return jsonify({"logs": [l.to_dict() for l in logs]}), 200
