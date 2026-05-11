"""
routes/profile.py
View and update student profiles + trigger Codeforces sync.
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Profile
from utils.codeforces import sync_user_stats
from utils.leetcode import sync_leetcode_stats
from utils.scoring import update_user_scores

profile_bp = Blueprint("profile", __name__)


@profile_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_my_profile():
    """GET /api/profile — returns logged-in user's full profile."""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first_or_404()
    profile = Profile.objects(user=user).first_or_404()
    return jsonify({**user.to_dict(), **profile.to_dict()}), 200


@profile_bp.route("/profile/<uid>", methods=["GET"])
@jwt_required()
def get_profile(uid):
    """GET /api/profile/<uid> — public profile view."""
    user = User.objects(id=uid).first_or_404()
    profile = Profile.objects(user=user).first_or_404()
    return jsonify({**user.to_dict(), **profile.to_dict()}), 200


@profile_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    """
    PUT /api/profile
    """
    user_id = get_jwt_identity()
    data = request.get_json()
    user = User.objects(id=user_id).first_or_404()
    profile = Profile.objects(user=user).first_or_404()

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

    if data.get("github_url"):
        from utils.github_ai import analyze_github_profile
        analysis = analyze_github_profile(data["github_url"])
        if analysis:
            profile.github_impl_score = analysis["implementation"]
            profile.github_imp_score = analysis["impact"]
            profile.github_work_score = analysis["working"]
            profile.github_total_score = analysis["total"]
            profile.github_review_reason = analysis["reason"]

    profile.save()
    update_user_scores(user_id)
    return jsonify({"message": "Profile updated", "profile": profile.to_dict()}), 200


@profile_bp.route("/profile/sync", methods=["POST"])
@jwt_required()
def sync_profiles():
    """
    POST /api/profile/sync — Manual refresh for both Codeforces and LeetCode.
    """
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first_or_404()
    profile = Profile.objects(user=user).first_or_404()

    if not profile.cf_handle and not profile.lc_username:
        return jsonify({"error": "No handles set. Update your profile first."}), 400

    if profile.cf_handle:
        cf_stats = sync_user_stats(profile.cf_handle)
        profile.cf_rating          = cf_stats.get("cf_rating", 0)
        profile.cf_max_rating      = cf_stats.get("cf_max_rating", 0)
        profile.cf_rank            = cf_stats.get("cf_rank", "unrated")
        profile.cf_problems_solved = cf_stats.get("cf_problems_solved", 0)
        profile.avatar_url         = cf_stats.get("avatar_url")

    if profile.lc_username:
        lc_stats = sync_leetcode_stats(profile.lc_username)
        if lc_stats:
            profile.lc_rating          = lc_stats.get("lc_rating", 0)
            profile.lc_max_rating      = lc_stats.get("lc_max_rating", 0)
            profile.lc_rank            = lc_stats.get("lc_rank", 0)
            profile.lc_problems_solved = lc_stats.get("lc_problems_solved", 0)

    if profile.github_url:
        from utils.github_ai import analyze_github_profile
        analysis = analyze_github_profile(profile.github_url)
        if analysis:
            profile.github_impl_score = analysis["implementation"]
            profile.github_imp_score = analysis["impact"]
            profile.github_work_score = analysis["working"]
            profile.github_total_score = analysis["total"]
            profile.github_review_reason = analysis["reason"]

    profile.last_synced = datetime.utcnow()
    profile.save()
    update_user_scores(user_id)

    return jsonify({"message": "Synced successfully", "profile": profile.to_dict()}), 200
