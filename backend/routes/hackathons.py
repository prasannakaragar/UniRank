from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Profile, HackathonSubmission, HackathonResult, Notification
from utils.auth_middleware import roles_required
from utils.scoring import update_user_scores

hackathons_bp = Blueprint("hackathons", __name__)

POINTS_MAP = {
    1: 100,
    2: 50,
    3: 25
}
REVIEW_THRESHOLD = 2

@hackathons_bp.route("/hackathons/submit", methods=["POST"])
@jwt_required()
def submit_hackathon():
    current_uid = get_jwt_identity()
    user = User.objects(id=current_uid).first()
    
    data = request.get_json()
    hackathon_name = data.get("hackathon_name")
    position = data.get("position")
    certificate_url = data.get("certificate_url")
    
    if not all([hackathon_name, position, certificate_url]):
        return jsonify({"error": "Missing required fields"}), 400
        
    try:
        position = int(position)
    except ValueError:
        return jsonify({"error": "Invalid position"}), 400
        
    submission = HackathonSubmission(
        user=user,
        hackathon_name=hackathon_name,
        position=position,
        certificate_url=certificate_url
    )
    submission.save()
    
    # Notify all admins & superadmins of the user's college (and superadmins globally)
    admins = User.objects(role__in=['admin', 'superadmin', 'reviewer'])
    for admin in admins:
        admin_domain = admin.email.split("@")[1]
        user_domain = user.email.split("@")[1]
        if admin.role == 'superadmin' or admin_domain == user_domain:
            Notification(
                recipient=admin,
                title="New Hackathon Submission",
                message=f"{user.name} submitted a certificate for {hackathon_name} (Position: {position}).",
                type="hackathon_review",
                link="/admin/dashboard" # Assuming this is the frontend route
            ).save()
            
    return jsonify({"message": "Submission received. Pending review."}), 201


@hackathons_bp.route("/hackathons/submissions", methods=["GET"])
@jwt_required()
@roles_required('admin', 'superadmin', 'reviewer')
def get_submissions():
    current_uid = get_jwt_identity()
    user = User.objects(id=current_uid).first()
    
    if user.role == 'superadmin':
        submissions = HackathonSubmission.objects(status='pending').order_by('-created_at')
    else:
        # Get submissions only from the admin's college domain
        admin_domain = user.email.split("@")[1]
        college_users = User.objects(email__endswith=f"@{admin_domain}").values_list('id')
        submissions = HackathonSubmission.objects(user__in=college_users, status='pending').order_by('-created_at')
        
    return jsonify({"submissions": [s.to_dict() for s in submissions]}), 200


@hackathons_bp.route("/hackathons/submissions/<sub_id>/review", methods=["POST"])
@jwt_required()
@roles_required('admin', 'superadmin', 'reviewer')
def review_submission(sub_id):
    current_uid = get_jwt_identity()
    admin_user = User.objects(id=current_uid).first()
    
    data = request.get_json()
    action = data.get("action") # 'approve' or 'reject'
    
    if action not in ['approve', 'reject']:
        return jsonify({"error": "Invalid action"}), 400
        
    submission = HackathonSubmission.objects(id=sub_id).first_or_404()
    
    if submission.status != 'pending':
        return jsonify({"error": "Submission is already processed"}), 400
        
    admin_domain = admin_user.email.split("@")[1]
    user_domain = submission.user.email.split("@")[1]
    if admin_user.role != 'superadmin' and user_domain != admin_domain:
        return jsonify({"error": "Cannot review submissions from other colleges"}), 403
        
    if admin_user in submission.approvals or admin_user in submission.rejections:
        return jsonify({"error": "You have already reviewed this submission"}), 400
        
    if action == 'approve':
        submission.approvals.append(admin_user)
    else:
        submission.rejections.append(admin_user)
        
    submission.save()
    
    # Check threshold
    if len(submission.approvals) >= REVIEW_THRESHOLD:
        submission.status = 'approved'
        submission.save()
        
        points = POINTS_MAP.get(submission.position, 10) # default 10 points for participation? User said 1st, 2nd, 3rd. Let's give 0 or 10. Let's give 10.
        if submission.position in POINTS_MAP:
            points = POINTS_MAP[submission.position]
        
        # Add to HackathonResult
        HackathonResult(
            user=submission.user,
            hackathon_name=submission.hackathon_name,
            position=submission.position,
            points=points
        ).save()
        
        # Update user profile score
        profile = Profile.objects(user=submission.user).first()
        if profile:
            profile.hackathon_score += points
            profile.save()
            update_user_scores(str(submission.user.id))
            
        # Notify user
        Notification(
            recipient=submission.user,
            title="Hackathon Submission Approved",
            message=f"Your submission for {submission.hackathon_name} was approved! You earned {points} points.",
            type="achievement"
        ).save()
        
        return jsonify({"message": "Submission approved and points awarded"}), 200
        
    elif len(submission.rejections) >= REVIEW_THRESHOLD:
        submission.status = 'rejected'
        submission.save()
        
        # Notify user
        Notification(
            recipient=submission.user,
            title="Hackathon Submission Rejected",
            message=f"Your submission for {submission.hackathon_name} could not be verified and was rejected.",
            type="system"
        ).save()
        
        return jsonify({"message": "Submission rejected"}), 200
        
    return jsonify({
        "message": "Review recorded. Waiting for more reviews.",
        "approvals": len(submission.approvals),
        "rejections": len(submission.rejections)
    }), 200

@hackathons_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    current_uid = get_jwt_identity()
    notifications = Notification.objects(recipient=current_uid).order_by('-created_at')
    return jsonify({"notifications": [n.to_dict() for n in notifications]}), 200

@hackathons_bp.route("/notifications/<notif_id>/read", methods=["POST"])
@jwt_required()
def mark_notification_read(notif_id):
    current_uid = get_jwt_identity()
    notif = Notification.objects(id=notif_id, recipient=current_uid).first_or_404()
    notif.is_read = True
    notif.save()
    return jsonify({"message": "Marked as read"}), 200
