"""
routes/leaderboard.py
Supports Global, CP, and Hackathon leaderboards.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Profile, HackathonResult
from utils.auth_middleware import roles_required

leaderboard_bp = Blueprint("leaderboard", __name__)


def get_lb_cache_key(current_user=None):
    """Generate a unique cache key based on query params and user college if scope is college."""
    args = request.args
    scope = args.get("scope", "global")
    
    # Crucial: Include the user's specific college domain if scope is college
    # to avoid different colleges sharing the same cache key.
    college_domain = ""
    if scope == "college" and current_user:
        try:
            college_domain = current_user.email.split("@")[1].strip().lower()
        except Exception:
            pass
            
    key = f"lb_{args.get('type','cp')}_{scope}_{college_domain}_{args.get('branch','')}_{args.get('year','')}"
    return key


@leaderboard_bp.route("/leaderboard", methods=["GET"])
@jwt_required()
def get_leaderboard():
    """
    GET /api/leaderboard?type=cp|hackathon|github|overall&scope=global|college
    """
    current_user_id = get_jwt_identity()
    current_user = User.objects(id=current_user_id).first()

    cache = current_app.cache
    cache_key = get_lb_cache_key(current_user)
    
    cached_data = cache.get(cache_key)
    if cached_data:
        return jsonify(cached_data), 200

    lb_type = request.args.get("type", "cp")
    scope = request.args.get("scope", "global") # Default to global to show all colleges
    branch = request.args.get("branch")
    year = request.args.get("year")

    # 1. Base User Query (Filtering)
    # Filter by role="student" to only show students on the leaderboard.
    user_query = User.objects(role="student")

    if scope == "college" and current_user:
        try:
            domain = current_user.email.split("@")[1].strip().lower()
            user_query = user_query.filter(email__endswith=f"@{domain}")
        except Exception:
            pass

    if branch:
        user_query = user_query.filter(branch=branch)
    if year:
        user_query = user_query.filter(year=int(year))

    # 2. Map LB Type to Sort Field
    sort_map = {
        "cp": "-cp_score",
        "hackathon": "-hackathon_score",
        "github": "-github_total_score",
        "overall": "-global_score",
        "global": "-global_score"
    }
    sort_field = sort_map.get(lb_type, "-cp_score")

    # 3. Query Profiles
    # Always query profiles bound to our student user_query.
    # This prevents orphaned profiles, limits entries to active student accounts,
    # and keeps the global and college scopes perfectly aligned.
    query = Profile.objects(user__in=user_query)
    query = query.order_by(sort_field)

    # 4. Pagination
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, int(request.args.get("per_page", 50)))
    skip = (page - 1) * per_page

    if lb_type == "github":
        # Sort users using User.objects.order_by("-github_score")
        user_query = user_query.order_by("-github_score")
        total_count = user_query.count()
        users = user_query.skip(skip).limit(per_page)
        
        # Prefetch profiles for these users to optimize performance
        profiles_dict = {str(p.user.id): p for p in Profile.objects(user__in=users)}
        
        leaderboard = []
        for idx, user in enumerate(users):
            rank = skip + idx + 1
            p = profiles_dict.get(str(user.id))
            if not p:
                p = Profile(user=user)
                
            college_display = user.college
            if not college_display or college_display.strip().lower() == "unknown":
                try:
                    college_display = user.email.split("@")[1].strip().upper()
                except Exception:
                    college_display = "Unknown"

            entry = {
                "rank": rank,
                "user_id": str(user.id),
                "name": user.name,
                "branch": user.branch,
                "year": user.year,
                "college": college_display,
                "avatar_url": p.avatar_url,
                "github_url": p.github_url,
                "github_impl_score": user.github_implementation,
                "github_imp_score": user.github_impact,
                "github_work_score": user.github_working,
                "github_total_score": user.github_score,
                "github_review_reason": p.github_review_reason,
                "github_username": p.github_username or "",
                "github_rank": p.github_rank or "",
                "github_score": user.github_score,
            }
            leaderboard.append(entry)
    else:
        # 3. Query Profiles
        # Always query profiles bound to our student user_query.
        query = Profile.objects(user__in=user_query)
        query = query.order_by(sort_field)
        total_count = query.count()
        profiles = query.skip(skip).limit(per_page)
        leaderboard = []

        # Build Result
        for idx, p in enumerate(profiles):
            rank = skip + idx + 1
            user = p.user
            if not user:
                continue

            college_display = user.college
            if not college_display or college_display.strip().lower() == "unknown":
                try:
                    college_display = user.email.split("@")[1].strip().upper()
                except Exception:
                    college_display = "Unknown"

            entry = {
                "rank": rank,
                "user_id": str(user.id),
                "name": user.name,
                "branch": user.branch,
                "year": user.year,
                "college": college_display,
                "avatar_url": p.avatar_url,
            }

            if lb_type == "cp":
                entry.update({
                    "cf_handle": p.cf_handle,
                    "cf_rating": p.cf_rating,
                    "cf_rank": p.cf_rank,
                    "cf_problems_solved": p.cf_problems_solved,
                    "lc_username": p.lc_username,
                    "lc_rating": p.lc_rating,
                    "lc_problems_solved": p.lc_problems_solved,
                    "cp_score": round(p.cp_score, 1)
                })
            elif lb_type == "hackathon":
                h_count = HackathonResult.objects(user=user).count()
                entry.update({
                    "score": p.hackathon_score,
                    "hackathons_count": h_count
                })
            elif lb_type in ["overall", "global"]:
                entry.update({
                    "score": round(p.global_score, 1),
                    "global_score": round(p.global_score, 1),
                    "cp_score": round(p.cp_score, 1),
                    "hackathon_score": p.hackathon_score,
                    "github_score": round(user.github_score, 1) if user else 0.0
                })
            
            leaderboard.append(entry)

    response_data = {
        "leaderboard": leaderboard, 
        "total": total_count,
        "page": page,
        "per_page": per_page
    }
    cache.set(cache_key, response_data, timeout=300)

    return jsonify(response_data), 200


@leaderboard_bp.route("/hackathon/result", methods=["POST"])
@jwt_required()
@roles_required('admin', 'superadmin', 'reviewer')
def add_hackathon_result():
    """
    POST /api/hackathon/result
    (Manual entry by admins, students must use /api/hackathons/submit)
    """
    current_user_id = get_jwt_identity()
    user = User.objects(id=current_user_id).first_or_404()
    
    data = request.get_json()
    
    if user.role == 'student':
        target_user_id = current_user_id
    else:
        target_user_id = data.get("user_id", current_user_id)

    target_user = User.objects(id=target_user_id).first_or_404()
    h_name = data.get("hackathon_name")
    position = data.get("position", 0)
    points = data.get("points", 0)

    if not h_name:
        return jsonify({"error": "Missing hackathon_name"}), 400

    new_res = HackathonResult(
        user=target_user,
        hackathon_name=h_name,
        position=position,
        points=points
    )
    new_res.save()
    
    from utils.scoring import update_user_scores
    update_user_scores(target_user_id)

    return jsonify({"message": "Hackathon result added successfully", "result": new_res.to_dict()}), 201


@leaderboard_bp.route("/hackathon/result/<res_id>", methods=["DELETE"])
@jwt_required()
def delete_hackathon_result(res_id):
    """
    DELETE /api/hackathon/result/<id>
    """
    current_user_id = get_jwt_identity()
    res = HackathonResult.objects(id=res_id).first_or_404()
    
    if str(res.user.id) != current_user_id:
        return jsonify({"error": "Not authorized"}), 403
        
    res.delete()
    update_user_scores(current_user_id)
    
    return jsonify({"message": "Result deleted"}), 200
