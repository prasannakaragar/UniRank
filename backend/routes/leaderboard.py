"""
routes/leaderboard.py
Supports Global, CP, and Hackathon leaderboards.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Profile, HackathonResult

leaderboard_bp = Blueprint("leaderboard", __name__)


def get_lb_cache_key():
    """Generate a unique cache key based on query params."""
    args = request.args
    key = f"lb_{args.get('type','cp')}_{args.get('scope','global')}_{args.get('college','')}_{args.get('branch','')}_{args.get('year','')}"
    return key


@leaderboard_bp.route("/leaderboard", methods=["GET"])
@jwt_required()
def get_leaderboard():
    """
    GET /api/leaderboard
    """
    cache = current_app.cache
    cache_key = get_lb_cache_key()
    
    cached_data = cache.get(cache_key)
    if cached_data:
        return jsonify(cached_data), 200

    current_user_id = get_jwt_identity()
    current_user = User.objects(id=current_user_id).first()

    lb_type = request.args.get("type", "cp")
    scope = request.args.get("scope", "global")
    college_filter = request.args.get("college")
    branch = request.args.get("branch")
    year = request.args.get("year")

    user_query = User.objects()
    
    if scope == "college":
        if college_filter:
            domain = college_filter
        else:
            domain = current_user.email.split("@")[1] if current_user else ""
            
        if domain:
            user_query = user_query.filter(email__endswith=f"@{domain}")

    if branch:
        user_query = user_query.filter(branch=branch)
    if year:
        user_query = user_query.filter(year=int(year))

    query_params = {'user__in': user_query}
    query = Profile.objects(**query_params)

    if lb_type == "cp":
        from mongoengine import Q
        query = query.filter(Q(cf_handle__exists=True, cf_handle__ne="") | Q(lc_username__exists=True, lc_username__ne="")).order_by('-cp_score')
    elif lb_type == "hackathon":
        query = query.order_by('-hackathon_score')
    elif lb_type == "github":
        query = query.filter(github_total_score__gt=0).order_by('-github_total_score')

    # Pagination
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, int(request.args.get("per_page", 50)))
    skip = (page - 1) * per_page
    total_count = query.count()

    profiles = query.skip(skip).limit(per_page)
    leaderboard = []

    for idx, p in enumerate(profiles):
        rank = skip + idx + 1
        user = p.user
        entry = {
            "rank": rank,
            "user_id": str(user.id),
            "name": user.name,
            "branch": user.branch,
            "year": user.year,
            "avatar_url": p.avatar_url,
        }

        if lb_type == "cp":
            cp_score = (p.cf_rating + p.lc_rating) / 2
            entry.update({
                "cf_handle": p.cf_handle,
                "cf_rating": p.cf_rating,
                "cf_rank": p.cf_rank,
                "cf_problems_solved": p.cf_problems_solved,
                "lc_username": p.lc_username,
                "lc_rating": p.lc_rating,
                "lc_problems_solved": p.lc_problems_solved,
                "cp_score": round(cp_score, 1)
            })
        elif lb_type == "hackathon":
            h_count = HackathonResult.objects(user=user).count()
            entry.update({
                "score": p.hackathon_score,
                "hackathons_count": h_count
            })
        elif lb_type == "github":
            entry.update({
                "github_url": p.github_url,
                "github_impl_score": p.github_impl_score,
                "github_imp_score": p.github_imp_score,
                "github_work_score": p.github_work_score,
                "github_total_score": p.github_total_score,
                "github_review_reason": p.github_review_reason
            })
        
        leaderboard.append(entry)

    response_data = {
        "leaderboard": leaderboard, 
        "total": total_count,
        "page": page,
        "per_page": per_page
    }
    cache.set(cache_key, response_data, timeout=300) # Cache for 5 minutes

    return jsonify(response_data), 200


@leaderboard_bp.route("/hackathon/result", methods=["POST"])
@jwt_required()
def add_hackathon_result():
    """
    POST /api/hackathon/result
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
