"""
routes/teams.py
Team formation board — students signal availability or recruit members.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, TeamPost
from utils.scoring import update_user_scores

teams_bp = Blueprint("teams", __name__)


@teams_bp.route("/teams", methods=["GET"])
@jwt_required()
def list_teams():
    """
    GET /api/teams
    """
    post_type = request.args.get("type")
    query_params = {'is_active': True}
    if post_type:
        query_params['post_type'] = post_type
    
    posts = TeamPost.objects(**query_params).order_by('-created_at')
    return jsonify({"teams": [p.to_dict() for p in posts]}), 200


@teams_bp.route("/teams", methods=["POST"])
@jwt_required()
def create_team_post():
    """
    POST /api/teams
    """
    user_id = get_jwt_identity()
    data = request.get_json()

    if data.get("post_type") not in ("looking", "recruiting"):
        return jsonify({"error": "post_type must be 'looking' or 'recruiting'"}), 400
    if not data.get("title"):
        return jsonify({"error": "'title' is required"}), 400

    from models import User
    author = User.objects(id=user_id).first_or_404()

    skills = data.get("skills_needed", "")
    if isinstance(skills, list):
        skills = ",".join(skills)

    post = TeamPost(
        author=author,
        post_type=data["post_type"],
        title=data["title"].strip(),
        description=data.get("description"),
        skills_needed=skills,
        contact_info=data.get("contact_info"),
        team_size=data.get("team_size"),
    )
    post.save()
    update_user_scores(user_id)
    return jsonify({"message": "Team post created", "team": post.to_dict()}), 201


@teams_bp.route("/teams/<post_id>", methods=["DELETE"])
@jwt_required()
def delete_team_post(post_id):
    """DELETE /api/teams/<id> — author only."""
    user_id = get_jwt_identity()
    post = TeamPost.objects(id=post_id).first_or_404()
    if str(post.author.id) != user_id:
        return jsonify({"error": "Not authorized"}), 403
    post.delete()
    update_user_scores(user_id)
    return jsonify({"message": "Deleted"}), 200


@teams_bp.route("/teams/<post_id>/close", methods=["PATCH"])
@jwt_required()
def close_team_post(post_id):
    """PATCH /api/teams/<id>/close — mark post as inactive (team found)."""
    user_id = get_jwt_identity()
    post = TeamPost.objects(id=post_id).first_or_404()
    if str(post.author.id) != user_id:
        return jsonify({"error": "Not authorized"}), 403
    post.is_active = False
    post.save()
    return jsonify({"message": "Post marked as closed"}), 200
