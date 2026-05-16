"""
routes/announcements.py
CRUD for hackathon / contest announcements.
Any logged-in student can create; only author can delete.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Announcement
from utils.scoring import update_user_scores
from utils.auth_middleware import admin_only

announcements_bp = Blueprint("announcements", __name__)


@announcements_bp.route("/announcements", methods=["GET"])
@jwt_required()
def list_announcements():
    """
    GET /api/announcements
    """
    category = request.args.get("category")
    query_params = {}
    if category:
        query_params['category'] = category
    
    posts = Announcement.objects(**query_params).order_by('-is_pinned', '-created_at')
    return jsonify({"announcements": [p.to_dict() for p in posts]}), 200


@announcements_bp.route("/announcements", methods=["POST"])
@jwt_required()
@admin_only
def create_announcement():
    """
    POST /api/announcements
    """
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data.get("title") or not data.get("description"):
        return jsonify({"error": "title and description are required"}), 400

    from models import User
    author = User.objects(id=user_id).first_or_404()

    from datetime import datetime, timedelta
    expires_at = None
    event_date_str = data.get("event_date")
    if event_date_str:
        try:
            dt = datetime.strptime(event_date_str, "%Y-%m-%d")
            expires_at = dt + timedelta(days=1)
        except ValueError:
            pass

    post = Announcement(
        author=author,
        title=data["title"].strip(),
        description=data["description"].strip(),
        link=data.get("link"),
        event_date=event_date_str,
        category=data.get("category", "general"),
        organization=data.get("organization", ""),
        participation_type=data.get("participation_type", "Individual Participation"),
        mode=data.get("mode", "Online"),
        tags=data.get("tags", ""),
        deadline=data.get("deadline"),
        banner_url=data.get("banner_url"),
        background_banner_url=data.get("background_banner_url"),
        team_size=data.get("team_size", "Individual"),
        perks=data.get("perks", ""),
        expires_at=expires_at
    )
    post.save()
    update_user_scores(user_id)
    return jsonify({"message": "Announcement posted", "announcement": post.to_dict()}), 201


@announcements_bp.route("/announcements/<post_id>", methods=["DELETE"])
@jwt_required()
@admin_only
def delete_announcement(post_id):
    """DELETE /api/announcements/<id> — only Admins can delete."""
    user_id = get_jwt_identity()
    post = Announcement.objects(id=post_id).first_or_404()
    post.delete()
    update_user_scores(user_id)
    return jsonify({"message": "Deleted"}), 200
