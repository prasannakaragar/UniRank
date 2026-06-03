"""
routes/profile.py
View and update student profiles + trigger Codeforces sync.
"""
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Profile
from utils.codeforces import sync_user_stats
from utils.leetcode import sync_leetcode_stats
from utils.scoring import update_user_scores
from utils.github_stats import get_github_stats
from utils.rate_limiter import rate_limit

profile_bp = Blueprint("profile", __name__)


@profile_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_my_profile():
    """GET /api/profile — returns logged-in user's full profile."""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first_or_404()
    profile = Profile.objects(user=user).first_or_404()
    
    data = {**user.to_dict(), **profile.to_dict()}
    data["combined_score"] = profile.global_score # Map to frontend field name
    return jsonify(data), 200


@profile_bp.route("/profile/<uid>", methods=["GET"])
@jwt_required()
def get_profile(uid):
    """GET /api/profile/<uid> — public profile view."""
    user = User.objects(id=uid).first_or_404()
    profile = Profile.objects(user=user).first_or_404()
    
    data = {**user.to_dict(), **profile.to_dict()}
    data["combined_score"] = profile.global_score # Map to frontend field name
    
    current_user_id = get_jwt_identity()
    current_user = User.objects(id=current_user_id).first()
    data["is_following"] = current_user in profile.followers if current_user else False
    
    return jsonify(data), 200

@profile_bp.route("/profile/<uid>/follow", methods=["POST"])
@jwt_required()
def follow_user(uid):
    current_user_id = get_jwt_identity()
    if str(uid) == str(current_user_id):
        return jsonify({"error": "Cannot follow yourself"}), 400
        
    current_user = User.objects(id=current_user_id).first_or_404()
    target_user = User.objects(id=uid).first_or_404()
    
    current_profile = Profile.objects(user=current_user).first_or_404()
    target_profile = Profile.objects(user=target_user).first_or_404()
    
    if current_user not in target_profile.followers:
        target_profile.followers.append(current_user)
        target_profile.save()
        
    if target_user not in current_profile.following:
        current_profile.following.append(target_user)
        current_profile.save()
        
    return jsonify({"message": "Successfully followed user", "followers_count": len(target_profile.followers)}), 200

@profile_bp.route("/profile/<uid>/unfollow", methods=["POST"])
@jwt_required()
def unfollow_user(uid):
    current_user_id = get_jwt_identity()
    
    current_user = User.objects(id=current_user_id).first_or_404()
    target_user = User.objects(id=uid).first_or_404()
    
    current_profile = Profile.objects(user=current_user).first_or_404()
    target_profile = Profile.objects(user=target_user).first_or_404()
    
    if current_user in target_profile.followers:
        target_profile.followers.remove(current_user)
        target_profile.save()
        
    if target_user in current_profile.following:
        current_profile.following.remove(target_user)
        current_profile.save()
        
    return jsonify({"message": "Successfully unfollowed user", "followers_count": len(target_profile.followers)}), 200

@profile_bp.route("/profile/<uid>/followers", methods=["GET"])
@jwt_required()
def get_followers(uid):
    user = User.objects(id=uid).first_or_404()
    profile = Profile.objects(user=user).first_or_404()
    
    followers_data = []
    for follower in profile.followers:
        f_profile = Profile.objects(user=follower).first()
        followers_data.append({
            "id": str(follower.id),
            "name": follower.name,
            "branch": follower.branch,
            "year": follower.year,
            "avatar_url": f_profile.avatar_url if f_profile else None
        })
    return jsonify(followers_data), 200

@profile_bp.route("/profile/<uid>/following", methods=["GET"])
@jwt_required()
def get_following(uid):
    user = User.objects(id=uid).first_or_404()
    profile = Profile.objects(user=user).first_or_404()
    
    following_data = []
    for f in profile.following:
        f_profile = Profile.objects(user=f).first()
        following_data.append({
            "id": str(f.id),
            "name": f.name,
            "branch": f.branch,
            "year": f.year,
            "avatar_url": f_profile.avatar_url if f_profile else None
        })
    return jsonify(following_data), 200


@profile_bp.route("/profile", methods=["PUT"])
@profile_bp.route("/profile/<uid>", methods=["PUT"])
@jwt_required()
def update_profile(uid=None):
    """
    PUT /api/profile or /api/profile/<uid>
    """
    current_user_id = get_jwt_identity()
    target_user_id = uid if uid else current_user_id
    
    # Fetch requester
    requester = User.objects(id=current_user_id).first_or_404()
    
    # Mentor Role Restriction
    if requester.role == 'mentor':
        return jsonify({"error": "Mentors cannot edit profiles"}), 403
        
    # Permission Check: Only owner or Admin can edit
    if str(target_user_id) != str(current_user_id) and requester.role != 'admin':
        return jsonify({"error": "Not authorized to edit this profile"}), 403

    data = request.get_json()
    user = User.objects(id=target_user_id).first_or_404()
    profile = Profile.objects(user=user).first_or_404()

    # Admin only fields (if any, e.g. role, verification)
    if requester.role == 'admin':
        if "role" in data and data["role"] in ['student', 'mentor', 'admin']:
            user.role = data["role"]
            user.save()

    updatable = ["cf_handle", "lc_username", "bio", "skills", "github_url", "linkedin_url"]
    for field in updatable:
        if field in data:
            setattr(profile, field, data[field])

    if data.get("cf_handle"):
        stats = sync_user_stats(data["cf_handle"])
        profile.cf_rating          = stats.get("cf_rating", 0)
        profile.cf_max_rating      = stats.get("cf_max_rating", 0)
        profile.cf_rank            = stats.get("cf_rank", "unrated")
        profile.cf_problems_solved = stats.get("cf_problems_solved", 0)
        profile.avatar_url         = stats.get("avatar_url")
        profile.last_synced        = datetime.utcnow()

    if data.get("lc_username"):
        stats = sync_leetcode_stats(data["lc_username"])
        if stats:
            profile.lc_rating          = stats.get("lc_rating", 0)
            profile.lc_max_rating      = stats.get("lc_max_rating", 0)
            profile.lc_rank            = stats.get("lc_rank", 0)
            profile.lc_problems_solved = stats.get("lc_problems_solved", 0)
            profile.last_synced        = datetime.utcnow()

    if "github_url" in data:
        github_url = data["github_url"]
        if github_url:
            username = github_url.rstrip("/").split("/")[-1]
            profile.github_username = username

    profile.save()
    update_user_scores(str(user.id))
    return jsonify({"message": "Profile updated", "profile": profile.to_dict()}), 200


@profile_bp.route("/profile/sync", methods=["POST"])
@profile_bp.route("/profile/refresh/<uid>", methods=["POST"])
@jwt_required()
@rate_limit(max_requests=3, window_seconds=60)
def refresh_profile(uid=None):
    """
    POST /api/profile/sync (self)
    POST /api/profile/refresh/<uid> (any user)
    Manual refresh for GitHub, Codeforces, and LeetCode stats with a 1-hour cooldown for GitHub.
    """
    current_user_id = get_jwt_identity()
    target_user_id = uid if uid else current_user_id
    
    user = User.objects(id=target_user_id).first_or_404()
    profile = Profile.objects(user=user).first_or_404()

    # Extract GitHub username safely
    github_url = profile.github_url
    username = None
    if github_url:
        username = github_url.rstrip("/").split("/")[-1]
    if not username and profile.github_username:
        username = profile.github_username

    if not username:
        return jsonify({"error": "No GitHub username or URL configured."}), 400

    # Cooldown Check (1 Hour for GitHub Refresh)
    now = datetime.now(timezone.utc)
    if user.last_github_refresh:
        last_refresh = user.last_github_refresh
        if last_refresh.tzinfo is None:
            last_refresh = last_refresh.replace(tzinfo=timezone.utc)
            
        next_allowed = last_refresh + timedelta(hours=1)
        if now < next_allowed:
            remaining = (next_allowed - now).seconds // 60
            return jsonify({
                "error": "Too many requests",
                "next_refresh_in_minutes": remaining,
                "can_refresh": False
            }), 429

    # Sync Codeforces and LeetCode stats if they exist
    if profile.cf_handle:
        cf_stats = sync_user_stats(profile.cf_handle)
        profile.cf_rating          = cf_stats.get("cf_rating", 0)
        profile.cf_max_rating      = cf_stats.get("cf_max_rating", 0)
        profile.cf_rank            = cf_stats.get("cf_rank", "unrated")
        profile.cf_problems_solved = cf_stats.get("cf_problems_solved", 0)
        profile.cf_contests        = cf_stats.get("cf_contests", 0)
        if cf_stats.get("avatar_url"):
            profile.avatar_url     = cf_stats.get("avatar_url")

    if profile.lc_username:
        lc_stats = sync_leetcode_stats(profile.lc_username)
        if lc_stats:
            profile.lc_rating          = lc_stats.get("lc_rating", 0)
            profile.lc_max_rating      = lc_stats.get("lc_max_rating", 0)
            profile.lc_rank            = lc_stats.get("lc_rank", 0)
            profile.lc_problems_solved = lc_stats.get("lc_problems_solved", 0)

    # Fetch GitHub stats safely
    from utils.github_stats import get_github_stats, calculate_github_score
    
    old_impl = getattr(user, 'github_implementation', 0.0) or 0.0
    old_work = getattr(user, 'github_working', 0.0) or 0.0
    old_imp = getattr(user, 'github_impact', 0.0) or 0.0
    old_score = getattr(user, 'github_score', 0.0) or 0.0

    api_failed = False
    try:
        gh_stats = get_github_stats(username)
        if not gh_stats or (gh_stats.get("github_repos") == 0 and gh_stats.get("github_commits") == 0 and old_score > 0):
            api_failed = True
    except Exception as e:
        api_failed = True

    if api_failed:
        # DO NOT overwrite existing score, return old score
        current_app.logger.warning(f"[GITHUB REFRESH] API failure for {user.email}, returning old score {old_score}")
        profile.last_synced = datetime.utcnow()
        profile.save()
        return jsonify({
            "github_score": old_score,
            "implementation": old_impl,
            "working": old_work,
            "impact": old_imp,
            "can_refresh": True
        }), 200

    profile.github_repos = gh_stats.get("github_repos", 0)
    profile.github_stars = gh_stats.get("github_stars", 0)
    profile.github_commits = gh_stats.get("github_commits", 0)
    
    try:
        scores = calculate_github_score(gh_stats)
        implementation = scores.get("github_impl", 0.0)
        working = scores.get("github_working", 0.0)
        impact = scores.get("github_impact", 0.0)
        github_score = round((implementation + working + impact) / 3.0, 2)
        github_rank = scores.get("github_rank", "Starter")
    except Exception as e:
        implementation = old_impl
        working = old_work
        impact = old_imp
        github_score = old_score
        github_rank = profile.github_rank or "Starter"

    # Clamp score if needed
    github_score = max(0.0, min(10.0, github_score))

    # Save to DB (User model is single source of truth)
    user.github_implementation = implementation
    user.github_working = working
    user.github_impact = impact
    user.github_score = github_score
    user.last_github_refresh = now
    user.save()

    # Sync to Profile for backward compatibility
    profile.github_impl_score = implementation
    profile.github_work_score = working
    profile.github_imp_score = impact
    profile.github_total_score = github_score
    profile.github_rank = github_rank
    profile.last_synced = datetime.utcnow()
    profile.save()

    # Recalculate overall global score
    update_user_scores(str(user.id))

    # Log refresh event
    current_app.logger.info(f"[GITHUB REFRESH] {user.email} → {github_score}")

    # Clear leaderboard cache so the new score reflects immediately
    try:
        current_app.cache.clear()
    except Exception:
        pass

    return jsonify({
        "github_score": github_score,
        "implementation": implementation,
        "working": working,
        "impact": impact,
        "can_refresh": True
    }), 200
