"""
routes/chats.py
REST API for the Chats / Messaging module.

Endpoints:
  GET    /api/chats                          — list my conversations
  POST   /api/chats/dm                       — start (or fetch) a DM with a user
  POST   /api/chats/group                    — create a group conversation
  GET    /api/chats/<conv_id>/messages       — fetch paginated messages
  POST   /api/chats/<conv_id>/messages       — send a message
  DELETE /api/chats/<conv_id>/messages/<msg_id> — soft-delete a message
  POST   /api/chats/<conv_id>/read           — mark conversation as read
  POST   /api/chats/<conv_id>/members        — add member to group
  DELETE /api/chats/<conv_id>/members/<uid>  — remove member from group
  GET    /api/chats/search/users             — search users to start a chat
  GET    /api/chats/unread                   — total unread badge count
  DELETE /api/chats/<conv_id>               — delete DM or leave group
  POST   /api/chats/block/<uid>              — block a user
  DELETE /api/chats/block/<uid>              — unblock a user
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Conversation, ConversationMember, Message, Profile
from socket_io import socketio
from flask_socketio import emit, join_room, leave_room

chats_bp = Blueprint("chats", __name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _current_user():
    return User.objects(id=get_jwt_identity()).first()


def _is_member(conv, user_id):
    return conv.get_member(user_id) is not None


# ── List conversations ────────────────────────────────────────────────────────

@chats_bp.route("/chats", methods=["GET"])
@jwt_required()
def list_conversations():
    """Return all conversations the current user is a member of, newest first."""
    uid = get_jwt_identity()
    user = _current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    # MongoEngine query: conversations where members.user = user
    convs = Conversation.objects(members__user=user).order_by("-updated_at")

    return jsonify({"conversations": [c.to_dict(viewer_id=uid) for c in convs]}), 200


# ── Start / Get DM ───────────────────────────────────────────────────────────

@chats_bp.route("/chats/dm", methods=["POST"])
@jwt_required()
def start_dm():
    """
    POST /api/chats/dm   body: { user_id }
    Find or create a DM conversation between current user and target.
    Returns the conversation.
    """
    uid  = get_jwt_identity()
    me   = _current_user()
    data = request.get_json() or {}
    target_id = data.get("user_id")

    if not target_id or target_id == uid:
        return jsonify({"error": "Invalid target user"}), 400

    other = User.objects(id=target_id).first()
    if not other:
        return jsonify({"error": "User not found"}), 404

    # Check if DM already exists between the two users
    existing = Conversation.objects(
        kind="dm",
        members__user=me
    )
    for conv in existing:
        ids = {str(m.user.id) for m in conv.members}
        if ids == {uid, target_id}:
            return jsonify({"conversation": conv.to_dict(viewer_id=uid)}), 200

    # Create new DM
    conv = Conversation(
        kind="dm",
        created_by=me,
        members=[
            ConversationMember(user=me,    is_admin=True),
            ConversationMember(user=other, is_admin=False),
        ]
    )
    conv.save()
    return jsonify({"conversation": conv.to_dict(viewer_id=uid)}), 201


# ── Create Group ─────────────────────────────────────────────────────────────

@chats_bp.route("/chats/group", methods=["POST"])
@jwt_required()
def create_group():
    """
    POST /api/chats/group
    Body: { name, description?, member_ids: [...] }
    """
    uid  = get_jwt_identity()
    me   = _current_user()
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Group name is required"}), 400

    member_ids = data.get("member_ids", [])
    all_ids    = list(dict.fromkeys([uid] + [str(i) for i in member_ids]))  # dedup, creator first

    members = []
    for idx, mid in enumerate(all_ids):
        u = User.objects(id=mid).first()
        if u:
            members.append(ConversationMember(
                user=u,
                is_admin=(idx == 0),  # creator is admin
            ))

    if len(members) < 2:
        return jsonify({"error": "A group needs at least 2 members"}), 400

    conv = Conversation(
        kind="group",
        name=name,
        description=(data.get("description") or "").strip(),
        created_by=me,
        members=members,
    )
    conv.save()
    return jsonify({"conversation": conv.to_dict(viewer_id=uid)}), 201


# ── Fetch Messages ────────────────────────────────────────────────────────────

@chats_bp.route("/chats/<conv_id>/messages", methods=["GET"])
@jwt_required()
def get_messages(conv_id):
    """
    GET /api/chats/<conv_id>/messages?page=1&per_page=50
    Returns paginated messages, oldest-first within a page.
    """
    uid  = get_jwt_identity()
    user = _current_user()
    conv = Conversation.objects(id=conv_id).first()
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404
    if not _is_member(conv, uid):
        return jsonify({"error": "Access denied"}), 403

    page     = max(1, int(request.args.get("page", 1)))
    per_page = min(100, int(request.args.get("per_page", 50)))
    skip     = (page - 1) * per_page

    msgs = (
        Message.objects(conversation=conv, deleted_for__ne=user)
        .order_by("-created_at")
        .skip(skip)
        .limit(per_page)
    )
    # Reverse so client gets oldest→newest
    msgs_list = list(reversed([m.to_dict() for m in msgs]))

    # Mark delivered for messages not sent by current user
    Message.objects(
        conversation=conv,
        status="sent"
    ).filter(sender__ne=_current_user()).update(set__status="delivered")

    return jsonify({
        "messages": msgs_list,
        "page":     page,
        "per_page": per_page,
    }), 200


# ── Send Message ──────────────────────────────────────────────────────────────

@chats_bp.route("/chats/<conv_id>/messages", methods=["POST"])
@jwt_required()
def send_message(conv_id):
    """
    POST /api/chats/<conv_id>/messages
    Body: { content, mention_ids?: [...] }
    """
    uid  = get_jwt_identity()
    me   = _current_user()
    conv = Conversation.objects(id=conv_id).first()

    if not conv:
        return jsonify({"error": "Conversation not found"}), 404
    if not _is_member(conv, uid):
        return jsonify({"error": "Access denied"}), 403

    data    = request.get_json() or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Message content is required"}), 400
    if len(content) > 4000:
        return jsonify({"error": "Message too long (max 4000 chars)"}), 400

    # Resolve @mention user ids
    mention_ids = data.get("mention_ids", [])
    mentioned   = [User.objects(id=mid).first() for mid in mention_ids if mid]
    mentioned   = [u for u in mentioned if u]

    msg = Message(
        conversation=conv,
        sender=me,
        text=content,
        mentions=mentioned,
    )
    msg.save()

    # Update conversation preview + bump unread for everyone else
    conv.last_message = content[:120] + ("…" if len(content) > 120 else "")
    conv.last_sender  = me.name
    conv.updated_at   = datetime.utcnow()
    for m in conv.members:
        if str(m.user.id) != uid:
            m.unread_count += 1
    conv.save()

    # Emit real-time event to the conversation room
    socketio.emit("new_message", {
        "conversation_id": conv_id,
        "message": msg.to_dict()
    }, room=conv_id)

    # Emit unread badge update to all members
    for m in conv.members:
        socketio.emit("unread_update", {
            "conversation_id": conv_id,
            "unread_count": m.unread_count
        }, room=f"user_{str(m.user.id)}")

    return jsonify({"message": msg.to_dict()}), 201


# ── Soft-Delete Message ───────────────────────────────────────────────────────

@chats_bp.route("/chats/<conv_id>/messages/bulk-delete", methods=["DELETE"])
@jwt_required()
def bulk_delete_messages(conv_id):
    """
    DELETE /api/chats/<conv_id>/messages/bulk-delete
    Body: { message_ids: [...], mode: 'me' | 'everyone' }
    """
    uid = get_jwt_identity()
    user = _current_user()
    data = request.get_json() or {}
    msg_ids = data.get("message_ids", [])
    mode = data.get("mode", "me")

    if not msg_ids:
        return jsonify({"error": "No messages selected"}), 400

    conv = Conversation.objects(id=conv_id).first()
    if not conv or not _is_member(conv, uid):
        return jsonify({"error": "Conversation not found or access denied"}), 403

    deleted_count = 0
    for mid in msg_ids:
        msg = Message.objects(id=mid, conversation=conv_id).first()
        if not msg:
            continue

        if mode == "everyone":
            if str(msg.sender.id) == uid:
                msg.delete()
                deleted_count += 1
                socketio.emit("message_deleted", {
                    "conversation_id": conv_id,
                    "message_id": mid,
                    "mode": "everyone"
                }, room=conv_id)
        else: # mode == "me"
            if user not in msg.deleted_for:
                msg.deleted_for.append(user)
                
                # Cleanup: If everyone in the conversation has deleted it for themselves, 
                # we can safely remove it from the DB entirely.
                if len(msg.deleted_for) >= len(conv.members):
                    msg.delete()
                else:
                    msg.save()
                
                deleted_count += 1
                socketio.emit("message_deleted", {
                    "conversation_id": conv_id,
                    "message_id": mid,
                    "mode": "me"
                }, room=f"user_{uid}")

    return jsonify({"ok": True, "deleted_count": deleted_count}), 200


@chats_bp.route("/chats/<conv_id>/messages/<msg_id>", methods=["DELETE"])
@jwt_required()
def delete_message(conv_id, msg_id):
    """
    DELETE /api/chats/<conv_id>/messages/<msg_id>?mode=me|everyone
    """
    uid = get_jwt_identity()
    user = _current_user()
    mode = request.args.get("mode", "me") # "me" or "everyone"

    conv = Conversation.objects(id=conv_id).first()
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404

    msg = Message.objects(id=msg_id, conversation=conv_id).first()
    if not msg:
        return jsonify({"error": "Message not found"}), 404

    if mode == "everyone":
        if str(msg.sender.id) != uid:
            return jsonify({"error": "Cannot delete another user's message for everyone"}), 403
        
        # Hard delete from MongoDB
        msg.delete()

        socketio.emit("message_deleted", {
            "conversation_id": conv_id,
            "message_id": msg_id,
            "mode": "everyone"
        }, room=conv_id)

    else: # mode == "me"
        if user not in msg.deleted_for:
            msg.deleted_for.append(user)
            
            # Cleanup: If everyone has deleted it for themselves, hard delete from DB
            if len(msg.deleted_for) >= len(conv.members):
                msg.delete()
            else:
                msg.save()
        
        # Only notify the specific user for "delete for me"
        socketio.emit("message_deleted", {
            "conversation_id": conv_id,
            "message_id": msg_id,
            "mode": "me"
        }, room=f"user_{uid}")

    return jsonify({"ok": True}), 200


# ── Forward Message ───────────────────────────────────────────────────────────

@chats_bp.route("/chats/messages/<msg_id>/forward", methods=["POST"])
@jwt_required()
def forward_message(msg_id):
    """
    POST /api/chats/messages/<msg_id>/forward
    Body: { target_chat_id }
    """
    uid = get_jwt_identity()
    me = _current_user()
    data = request.get_json() or {}
    target_chat_id = data.get("target_chat_id")

    if not target_chat_id:
        return jsonify({"error": "Target chat ID required"}), 400

    old_msg = Message.objects(id=msg_id).first()
    if not old_msg:
        return jsonify({"error": "Original message not found"}), 404
    
    target_conv = Conversation.objects(id=target_chat_id).first()
    if not target_conv or not _is_member(target_conv, uid):
        return jsonify({"error": "Target chat not found or access denied"}), 403

    # Create NEW message entry
    new_msg = Message(
        conversation=target_conv,
        sender=me,
        text=old_msg.text,
        forwarded=True
    )
    new_msg.save()

    # Update conversation preview
    target_conv.last_message = "Forwarded: " + (new_msg.text[:100] + "...")
    target_conv.last_sender = me.name
    target_conv.updated_at = datetime.utcnow()
    for m in target_conv.members:
        if str(m.user.id) != uid:
            m.unread_count += 1
    target_conv.save()

    # Broadcast
    socketio.emit("new_message", {
        "conversation_id": target_chat_id,
        "message": new_msg.to_dict()
    }, room=target_chat_id)

    socketio.emit("message_forwarded", {
        "source_message_id": msg_id,
        "new_message": new_msg.to_dict()
    }, room=f"user_{uid}")

    return jsonify({"message": new_msg.to_dict()}), 201


# ── Mark Conversation as Read ─────────────────────────────────────────────────

@chats_bp.route("/chats/<conv_id>/read", methods=["POST"])
@jwt_required()
def mark_read(conv_id):
    uid  = get_jwt_identity()
    conv = Conversation.objects(id=conv_id).first()
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404

    member = conv.get_member(uid)
    if not member:
        return jsonify({"error": "Not a member"}), 403

    member.unread_count = 0
    member.last_read_at = datetime.utcnow()
    conv.save()

    # Mark all undelivered messages as 'seen'
    Message.objects(
        conversation=conv,
        status__in=["sent", "delivered"]
    ).filter(sender__ne=_current_user()).update(set__status="seen")

    socketio.emit("messages_read", {
        "conversation_id": conv_id,
        "user_id": uid
    }, room=conv_id)

    return jsonify({"ok": True}), 200


# ── Add / Remove Group Members ────────────────────────────────────────────────

@chats_bp.route("/chats/<conv_id>/members", methods=["POST"])
@jwt_required()
def add_member(conv_id):
    uid  = get_jwt_identity()
    conv = Conversation.objects(id=conv_id).first()
    if not conv or conv.kind != "group":
        return jsonify({"error": "Group not found"}), 404

    caller = conv.get_member(uid)
    if not caller or not caller.is_admin:
        return jsonify({"error": "Only admins can add members"}), 403

    data      = request.get_json() or {}
    target_id = data.get("user_id")
    target    = User.objects(id=target_id).first()
    if not target:
        return jsonify({"error": "User not found"}), 404
    if _is_member(conv, target_id):
        return jsonify({"error": "Already a member"}), 409

    conv.members.append(ConversationMember(user=target, is_admin=False))
    conv.save()
    return jsonify({"ok": True, "conversation": conv.to_dict(viewer_id=uid)}), 200


@chats_bp.route("/chats/<conv_id>/members/<target_uid>", methods=["DELETE"])
@jwt_required()
def remove_member(conv_id, target_uid):
    uid  = get_jwt_identity()
    conv = Conversation.objects(id=conv_id).first()
    if not conv or conv.kind != "group":
        return jsonify({"error": "Group not found"}), 404

    caller = conv.get_member(uid)
    # Allow self-leave or admin removal
    if not caller or (target_uid != uid and not caller.is_admin):
        return jsonify({"error": "Not authorised"}), 403

    conv.members = [m for m in conv.members if str(m.user.id) != target_uid]
    conv.save()
    return jsonify({"ok": True}), 200


# ── User Search (for starting chats) ─────────────────────────────────────────

@chats_bp.route("/chats/search/users", methods=["GET"])
@jwt_required()
def search_users():
    """
    GET /api/chats/search/users?q=<query>&branch=<branch>&year=<year>
    Returns matching users with basic profile info.
    """
    uid   = get_jwt_identity()
    q     = (request.args.get("q") or "").strip()
    branch = request.args.get("branch", "")
    year   = request.args.get("year", "")

    filters = {}
    if branch:
        filters["branch"] = branch
    if year:
        try:
            filters["year"] = int(year)
        except ValueError:
            pass

    # Exclude current user from results
    users = User.objects(**filters).filter(id__ne=uid)

    if q:
        # Case-insensitive name search
        import re
        pattern = re.compile(re.escape(q), re.IGNORECASE)
        users = [u for u in users if pattern.search(u.name) or pattern.search(u.email)]
    else:
        users = list(users.limit(30))

    results = []
    for u in users[:30]:
        profile = Profile.objects(user=u).first()
        results.append({
            "user_id":   str(u.id),
            "name":      u.name,
            "branch":    u.branch,
            "year":      u.year,
            "avatar_url": profile.avatar_url if profile else None,
            "cf_rating":  profile.cf_rating if profile else 0,
            "cf_rank":    profile.cf_rank if profile else "unrated",
        })

    return jsonify({"users": results}), 200


# ── Unread Badge Count ────────────────────────────────────────────────────────

@chats_bp.route("/chats/unread", methods=["GET"])
@jwt_required()
def unread_count():
    """Returns total unread message count across all conversations."""
    uid  = get_jwt_identity()
    user = _current_user()
    if not user:
        return jsonify({"unread": 0}), 200

    convs  = Conversation.objects(members__user=user)
    total  = sum(
        (conv.get_member(uid).unread_count if conv.get_member(uid) else 0)
        for conv in convs
    )
    return jsonify({"unread": total}), 200


# ── Block / Unblock ───────────────────────────────────────────────────────────

# Stored as a simple set on the User model isn't in the schema,
# so we use a lightweight in-process store backed by a meta-collection.
# For now we store block lists in a dedicated tiny collection.

class _BlockRecord(db.Document):
    meta       = {'collection': 'chat_blocks'}
    blocker    = db.ReferenceField(User, required=True)
    blocked    = db.ReferenceField(User, required=True)
    created_at = db.DateTimeField(default=datetime.utcnow)


@chats_bp.route("/chats/block/<target_uid>", methods=["POST"])
@jwt_required()
def block_user(target_uid):
    uid    = get_jwt_identity()
    me     = _current_user()
    target = User.objects(id=target_uid).first()
    if not target:
        return jsonify({"error": "User not found"}), 404
    if not _BlockRecord.objects(blocker=me, blocked=target).first():
        _BlockRecord(blocker=me, blocked=target).save()
    return jsonify({"ok": True, "blocked": target_uid}), 200


@chats_bp.route("/chats/block/<target_uid>", methods=["DELETE"])
@jwt_required()
def unblock_user(target_uid):
    uid    = get_jwt_identity()
    me     = _current_user()
    target = User.objects(id=target_uid).first()
    if target:
        _BlockRecord.objects(blocker=me, blocked=target).delete()
    return jsonify({"ok": True}), 200


# ── Delete / Leave Conversation ───────────────────────────────────────────────

@chats_bp.route("/chats/<conv_id>", methods=["DELETE"])
@jwt_required()
def delete_conversation(conv_id):
    """
    DELETE /api/chats/<conv_id>
    For DMs: Deletes the entire conversation and its messages.
    For Groups: Removes the current user from the members list.
    """
    uid = get_jwt_identity()
    conv = Conversation.objects(id=conv_id).first()
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404

    member = conv.get_member(uid)
    if not member:
        return jsonify({"error": "Access denied"}), 403

    if conv.kind == "dm":
        # Delete messages first
        Message.objects(conversation=conv).delete()
        conv.delete()
    else:
        # Group: just leave
        conv.members = [m for m in conv.members if str(m.user.id) != uid]
        if not conv.members:
            # If last member leaves, delete group and messages
            Message.objects(conversation=conv).delete()
            conv.delete()
        else:
            # If the user leaving was the only admin, appoint someone else
            if member.is_admin and not any(m.is_admin for m in conv.members):
                conv.members[0].is_admin = True
            conv.save()

    return jsonify({"ok": True}), 200


# ── SocketIO Events ──────────────────────────────────────────────────────────

@socketio.on("join")
def on_join(data):
    """User joins a conversation room or their personal notification room."""
    room = data.get("room")
    if room:
        join_room(room)
        # print(f"User joined room: {room}")


@socketio.on("leave")
def on_leave(data):
    """User leaves a room."""
    room = data.get("room")
    if room:
        leave_room(room)


@socketio.on("typing")
def on_typing(data):
    """Notify others in the room that a user is typing."""
    room = data.get("room")
    user_name = data.get("user_name")
    is_typing = data.get("is_typing", True)
    if room:
        emit("user_typing", {
            "user_name": user_name,
            "is_typing": is_typing
        }, room=room, include_self=False)
