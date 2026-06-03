"""
routes/hackathons.py
Certificate/Achievement submission and review system.

Students submit achievements → college-scoped admins review → instant approve/reject.
Points are event_type-based: Attended=10, Participated=15, 3rd=30, 2nd=50, 1st=100.
"""

from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Profile, HackathonSubmission, HackathonResult, Notification
from utils.auth_middleware import roles_required
from utils.scoring import update_user_scores
from socket_io import socketio

hackathons_bp = Blueprint("hackathons", __name__)

POINTS_MAP = {
    "Attended": 10,
    "Participated": 15,
    "3rd Place": 30,
    "2nd Place": 50,
    "1st Place": 100,
}

VALID_EVENT_TYPES = list(POINTS_MAP.keys())


# ── Student: Submit a certificate request ──────────────────────────────────────

@hackathons_bp.route("/hackathons/submit", methods=["POST"])
@jwt_required()
def submit_hackathon():
    current_uid = get_jwt_identity()
    user = User.objects(id=current_uid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    hackathon_name = data.get("hackathon_name", "").strip()
    event_type = data.get("event_type", "").strip()
    certificate_url = data.get("certificate_url", "")

    if not hackathon_name:
        return jsonify({"error": "Hackathon name is required"}), 400

    if event_type not in VALID_EVENT_TYPES:
        return jsonify({"error": f"Invalid event type. Must be one of: {', '.join(VALID_EVENT_TYPES)}"}), 400

    points_to_award = POINTS_MAP[event_type]

    # Map event_type to a position number for backward compat with HackathonResult
    position_map = {"1st Place": 1, "2nd Place": 2, "3rd Place": 3, "Participated": 0, "Attended": 0}

    submission = HackathonSubmission(
        user=user,
        hackathon_name=hackathon_name,
        event_type=event_type,
        certificate_url=certificate_url or "",
        points_to_award=points_to_award,
        position=position_map.get(event_type, 0),
    )
    submission.save()

    # ── Notify all admins from the same college domain ─────────────────────────
    user_domain = user.email.split("@")[1]
    admins = User.objects(role__in=["admin", "superadmin", "reviewer"])

    for admin in admins:
        admin_domain = admin.email.split("@")[1]
        # College-scoped: same domain, or superadmin sees everything
        if admin.role == "superadmin" or admin_domain == user_domain:
            Notification(
                recipient=admin,
                title="New Certificate Request",
                message=f"{user.name} submitted a certificate for {hackathon_name} ({event_type}).",
                type="certificate_request",
                request_id=submission,
                link="/profile",
            ).save()

    # ── Emit Socket.IO event for real-time admin bell ──────────────────────────
    try:
        socketio.emit("new_certificate_request", {
            "id": str(submission.id),
            "user_name": user.name,
            "hackathon_name": hackathon_name,
            "event_type": event_type,
            "points_to_award": points_to_award,
            "college_domain": user_domain,
        })
    except Exception:
        pass  # Socket.IO emit failure should not block the request

    return jsonify({"message": "Submission received. Pending review."}), 201


# ── Student: Get my own submissions ────────────────────────────────────────────

@hackathons_bp.route("/hackathons/my-submissions", methods=["GET"])
@jwt_required()
def get_my_submissions():
    current_uid = get_jwt_identity()
    submissions = HackathonSubmission.objects(user=current_uid).order_by("-created_at")
    return jsonify({"submissions": [s.to_dict() for s in submissions]}), 200


# ── Admin: Get all pending submissions (college-scoped) ────────────────────────

@hackathons_bp.route("/hackathons/pending-requests", methods=["GET"])
@jwt_required()
@roles_required("admin", "superadmin", "reviewer")
def get_pending_requests():
    current_uid = get_jwt_identity()
    user = User.objects(id=current_uid).first()

    if user.role == "superadmin":
        submissions = HackathonSubmission.objects(status="pending").order_by("-created_at")
    else:
        # College-scoped: only submissions from students with the same email domain
        admin_domain = user.email.split("@")[1]
        college_users = User.objects(email__endswith=f"@{admin_domain}").values_list("id")
        submissions = HackathonSubmission.objects(
            user__in=college_users, status="pending"
        ).order_by("-created_at")

    return jsonify({"submissions": [s.to_dict() for s in submissions]}), 200


# ── Admin: Get all submissions (legacy endpoint kept for backward compat) ──────

@hackathons_bp.route("/hackathons/submissions", methods=["GET"])
@jwt_required()
@roles_required("admin", "superadmin", "reviewer")
def get_submissions():
    current_uid = get_jwt_identity()
    user = User.objects(id=current_uid).first()

    if user.role == "superadmin":
        submissions = HackathonSubmission.objects(status="pending").order_by("-created_at")
    else:
        admin_domain = user.email.split("@")[1]
        college_users = User.objects(email__endswith=f"@{admin_domain}").values_list("id")
        submissions = HackathonSubmission.objects(
            user__in=college_users, status="pending"
        ).order_by("-created_at")

    return jsonify({"submissions": [s.to_dict() for s in submissions]}), 200


# ── Admin: Approve or Reject a submission (single-admin instant) ───────────────

@hackathons_bp.route("/hackathons/submissions/<sub_id>/review", methods=["POST"])
@jwt_required()
@roles_required("admin", "superadmin", "reviewer")
def review_submission(sub_id):
    current_uid = get_jwt_identity()
    admin_user = User.objects(id=current_uid).first()

    data = request.get_json()
    action = data.get("action")  # 'approve' or 'reject'

    if action not in ["approve", "reject"]:
        return jsonify({"error": "Invalid action. Must be 'approve' or 'reject'."}), 400

    submission = HackathonSubmission.objects(id=sub_id).first()
    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    if submission.status != "pending":
        return jsonify({"error": "Submission is already processed"}), 400

    # College-scoping check
    admin_domain = admin_user.email.split("@")[1]
    user_domain = submission.user.email.split("@")[1]
    if admin_user.role != "superadmin" and user_domain != admin_domain:
        return jsonify({"error": "Cannot review submissions from other colleges"}), 403

    # ── Mark the notification as read by this admin ─────────────────────────────
    cert_notifs = Notification.objects(request_id=submission, type="certificate_request")
    for notif in cert_notifs:
        if str(admin_user.id) not in (notif.read_by or []):
            notif.read_by = (notif.read_by or []) + [str(admin_user.id)]
            notif.is_read = True
            notif.save()

    now = datetime.utcnow()

    if action == "approve":
        submission.status = "approved"
        submission.reviewed_by = admin_user
        submission.reviewed_at = now
        submission.save()

        points = submission.points_to_award or POINTS_MAP.get(submission.event_type, 10)

        # Create HackathonResult for the approved achievement
        HackathonResult(
            user=submission.user,
            hackathon_name=submission.hackathon_name,
            position=submission.position or 0,
            points=points,
        ).save()

        # Update profile hackathon_score
        profile = Profile.objects(user=submission.user).first()
        if profile:
            profile.hackathon_score += points
            profile.save()
            update_user_scores(str(submission.user.id))

        # Notify the student
        Notification(
            recipient=submission.user,
            title="Achievement Approved!",
            message=f"Your submission for {submission.hackathon_name} was approved! You earned {points} points.",
            type="achievement",
        ).save()

        # Emit Socket.IO event for real-time student status update
        try:
            socketio.emit("certificate_status_update", {
                "request_id": str(submission.id),
                "student_id": str(submission.user.id),
                "status": "approved",
                "points": points,
                "event_name": submission.hackathon_name,
            })
        except Exception:
            pass

        return jsonify({
            "message": f"Approved! {points} points awarded to {submission.user.name}.",
            "points": points,
        }), 200

    else:  # reject
        submission.status = "rejected"
        submission.reviewed_by = admin_user
        submission.reviewed_at = now
        submission.save()

        # Notify the student
        Notification(
            recipient=submission.user,
            title="Submission Rejected",
            message=f"Your submission for {submission.hackathon_name} could not be verified and was rejected.",
            type="system",
        ).save()

        # Emit Socket.IO event for real-time student status update
        try:
            socketio.emit("certificate_status_update", {
                "request_id": str(submission.id),
                "student_id": str(submission.user.id),
                "status": "rejected",
                "points": 0,
                "event_name": submission.hackathon_name,
            })
        except Exception:
            pass

        return jsonify({"message": "Request rejected."}), 200


# ── Admin: Get unread certificate notification count ───────────────────────────

@hackathons_bp.route("/notifications/unread-count", methods=["GET"])
@jwt_required()
def get_unread_count():
    current_uid = get_jwt_identity()

    # Count certificate_request notifications where this admin hasn't actioned them
    notifications = Notification.objects(
        recipient=current_uid,
        type="certificate_request",
        is_read=False,
    )

    # Filter out ones where this admin is already in read_by
    count = 0
    for n in notifications:
        if str(current_uid) not in (n.read_by or []):
            count += 1

    return jsonify({"count": count}), 200


# ── Notifications: List and mark-read ──────────────────────────────────────────

@hackathons_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    current_uid = get_jwt_identity()
    notifications = Notification.objects(recipient=current_uid).order_by("-created_at")
    return jsonify({"notifications": [n.to_dict() for n in notifications]}), 200


@hackathons_bp.route("/notifications/<notif_id>/read", methods=["POST"])
@jwt_required()
def mark_notification_read(notif_id):
    current_uid = get_jwt_identity()
    notif = Notification.objects(id=notif_id, recipient=current_uid).first_or_404()
    notif.is_read = True
    notif.save()
    return jsonify({"message": "Marked as read"}), 200
