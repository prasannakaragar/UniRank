from flask_mongoengine import MongoEngine
from datetime import datetime

db = MongoEngine()


class College(db.Document):
    """
    Registry of allowed college domains.
    """
    meta = {'collection': 'colleges'}
    name   = db.StringField(max_length=200, required=True)
    domain = db.StringField(max_length=100, unique=True, required=True)

    def to_dict(self):
        return {"name": self.name, "domain": self.domain}


class PendingUser(db.Document):
    """
    Temporary storage for users who haven't verified their OTP yet.
    """
    meta = {
        'collection': 'pending_users',
        'indexes': [
            {'fields': ['otp_expiry'], 'expireAfterSeconds': 0}
        ]
    }

    name = db.StringField(max_length=100, required=True)
    email = db.StringField(max_length=150, unique=True, required=True)
    password = db.StringField(max_length=256, required=True)
    branch = db.StringField(max_length=100, required=True)
    year = db.IntField(required=True)
    college = db.StringField(max_length=200) # Auto-detected or selected
    otp_hash = db.StringField(required=True)
    otp_expiry = db.DateTimeField(required=True)
    attempts = db.IntField(default=0)
    created_at = db.DateTimeField(default=datetime.utcnow)


class User(db.Document):
    """
    Core user model — stores auth + academic info.
    College email domain is enforced at registration.
    """
    meta = {
        'collection': 'users',
        'indexes': [
            'email',
            'branch',
            'year',
            'role',
            '-created_at'
        ]
    }

    name         = db.StringField(max_length=100, required=True)
    email        = db.StringField(max_length=150, unique=True, required=True)
    password     = db.StringField(max_length=256, required=True)   # bcrypt hash
    branch       = db.StringField(max_length=100, required=True)
    year         = db.IntField(required=True)                      # 1 / 2 / 3 / 4
    college      = db.StringField(max_length=200, default="Unknown")
    role             = db.StringField(max_length=20, default="student") # student / faculty
    is_verified      = db.BooleanField(default=False)
    college_verified = db.BooleanField(default=False)
    otp_hash         = db.StringField()
    otp_expiry       = db.DateTimeField()
    attempts         = db.IntField(default=0)
    created_at       = db.DateTimeField(default=datetime.utcnow)

    def to_dict(self):
        # Fetch hackathon results and profile (simulating relationships)
        results = HackathonResult.objects(user=self)
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "branch": self.branch,
            "year": self.year,
            "college": self.college,
            "role": self.role,
            "is_verified": self.is_verified,
            "college_verified": self.college_verified,
            "hackathon_results": [h.to_dict() for h in results]
        }


class Profile(db.Document):
    """
    Extended profile — linked CP handles and cached stats.
    """
    meta = {
        'collection': 'profiles',
        'indexes': [
            'user',
            '-global_score',
            '-cp_score',
            '-cf_rating',
            '-lc_rating',
            'skills'
        ]
    }

    user               = db.ReferenceField(User, reverse_delete_rule=db.CASCADE, unique=True, required=True)
    cf_handle          = db.StringField(max_length=100)
    lc_username        = db.StringField(max_length=100)
    cf_rating          = db.IntField(default=0)
    cf_max_rating      = db.IntField(default=0)
    cf_rank            = db.StringField(max_length=50, default="unrated")
    cf_problems_solved = db.IntField(default=0)
    lc_rating          = db.IntField(default=0)
    lc_max_rating      = db.IntField(default=0)
    lc_rank            = db.IntField(default=0)
    lc_problems_solved = db.IntField(default=0)
    avatar_url         = db.StringField(max_length=300)
    bio                = db.StringField(max_length=300)
    skills             = db.StringField(max_length=300)   # comma-separated
    github_url         = db.StringField(max_length=200)
    linkedin_url       = db.StringField(max_length=200)
    last_synced        = db.DateTimeField()
    
    # Social
    followers          = db.ListField(db.ReferenceField(User))
    following          = db.ListField(db.ReferenceField(User))

    # GitHub Analysis (Review)
    github_impl_score    = db.FloatField(default=0.0)
    github_imp_score     = db.FloatField(default=0.0)
    github_work_score    = db.FloatField(default=0.0)
    github_total_score   = db.FloatField(default=0.0)
    github_review_reason = db.StringField(default="")

    # Cached scores for leaderboards
    cp_score             = db.FloatField(default=0.0)
    hackathon_score      = db.IntField(default=0)
    activity_score       = db.IntField(default=0)
    global_score         = db.FloatField(default=0.0)

    def to_dict(self):
        return {
            "user_id": str(self.user.id),
            "cf_handle": self.cf_handle,
            "lc_username": self.lc_username,
            "cf_rating": self.cf_rating,
            "cf_max_rating": self.cf_max_rating,
            "cf_rank": self.cf_rank,
            "cf_problems_solved": self.cf_problems_solved,
            "lc_rating": self.lc_rating,
            "lc_max_rating": self.lc_max_rating,
            "lc_rank": self.lc_rank,
            "lc_problems_solved": self.lc_problems_solved,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "skills": self.skills.split(",") if self.skills else [],
            "github_url": self.github_url,
            "linkedin_url": self.linkedin_url,
            "followers_count": len(self.followers),
            "following_count": len(self.following),
            "last_synced": self.last_synced.isoformat() if self.last_synced else None,
            "hackathon_score": self.hackathon_score,
            "activity_score": self.activity_score,
            "global_score": self.global_score,
            "github_analysis": {
                "implementation": self.github_impl_score,
                "impact": self.github_imp_score,
                "working": self.github_work_score,
                "total": self.github_total_score,
                "reason": self.github_review_reason
            }
        }


class HackathonResult(db.Document):
    """
    Stores individual hackathon participation and results.
    """
    meta = {'collection': 'hackathon_results'}

    user           = db.ReferenceField(User, reverse_delete_rule=db.CASCADE, required=True)
    hackathon_name = db.StringField(max_length=200, required=True)
    position       = db.IntField(default=0) 
    points         = db.IntField(default=0)
    date           = db.DateTimeField(default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "hackathon_name": self.hackathon_name,
            "position": self.position,
            "points": self.points,
            "date": self.date.isoformat()
        }


class Announcement(db.Document):
    """
    Posts for hackathons, coding contests, or opportunities.
    """
    meta = {
        'collection': 'announcements',
        'indexes': [
            {'fields': ['expires_at'], 'expireAfterSeconds': 0}
        ]
    }

    author      = db.ReferenceField(User, reverse_delete_rule=db.CASCADE, required=True)
    title       = db.StringField(max_length=200, required=True)
    description = db.StringField(required=True)
    link        = db.StringField(max_length=300)
    event_date  = db.StringField(max_length=50)
    category    = db.StringField(max_length=50, default="general")
    organization= db.StringField(max_length=200, default="")
    participation_type = db.StringField(max_length=100, default="Individual Participation")
    mode        = db.StringField(max_length=50, default="Online")
    tags        = db.StringField(max_length=300, default="")
    deadline    = db.StringField(max_length=50)
    banner_url  = db.StringField(max_length=500)
    background_banner_url = db.StringField(max_length=500)
    team_size   = db.StringField(max_length=50, default="Individual")
    perks       = db.StringField(max_length=300, default="")
    is_pinned   = db.BooleanField(default=False)
    created_at  = db.DateTimeField(default=datetime.utcnow)
    expires_at  = db.DateTimeField()

    def to_dict(self):
        return {
            "id": str(self.id),
            "author": self.author.name,
            "author_id": str(self.author.id),
            "title": self.title,
            "description": self.description,
            "link": self.link,
            "event_date": self.event_date,
            "category": self.category,
            "organization": self.organization,
            "participation_type": self.participation_type,
            "mode": self.mode,
            "tags": [t.strip() for t in self.tags.split(",") if t.strip()],
            "deadline": self.deadline,
            "banner_url": self.banner_url,
            "background_banner_url": self.background_banner_url,
            "team_size": self.team_size,
            "perks": self.perks,
            "is_pinned": self.is_pinned,
            "created_at": self.created_at.isoformat(),
        }


class TeamPost(db.Document):
    """
    Team formation board.
    """
    meta = {'collection': 'team_posts'}

    author        = db.ReferenceField(User, reverse_delete_rule=db.CASCADE, required=True)
    post_type     = db.StringField(max_length=30, required=True)
    title         = db.StringField(max_length=200, required=True)
    description   = db.StringField()
    skills_needed = db.StringField(max_length=300)
    contact_info  = db.StringField(max_length=200)
    team_size     = db.IntField()
    is_active     = db.BooleanField(default=True)
    created_at    = db.DateTimeField(default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "author": self.author.name,
            "author_branch": self.author.branch,
            "author_year": self.author.year,
            "post_type": self.post_type,
            "title": self.title,
            "description": self.description,
            "skills_needed": self.skills_needed.split(",") if self.skills_needed else [],
            "contact_info": self.contact_info,
            "team_size": self.team_size,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }



# ── Chat Models ───────────────────────────────────────────────────────────────

class ConversationMember(db.EmbeddedDocument):
    """
    Embedded doc tracking per-member metadata inside a Conversation.
    """
    user          = db.ReferenceField(User, required=True)
    unread_count  = db.IntField(default=0)
    is_admin      = db.BooleanField(default=False)
    joined_at     = db.DateTimeField(default=datetime.utcnow)
    last_read_at  = db.DateTimeField(default=datetime.utcnow)


class Conversation(db.Document):
    """
    Represents a DM or group chat conversation.
    kind: 'dm' | 'group'
    """
    meta = {
        'collection': 'conversations',
        'indexes': [
            'members.user',
            '-updated_at',
        ]
    }

    kind         = db.StringField(max_length=10, default='dm')  # 'dm' | 'group'
    name         = db.StringField(max_length=100)               # group name (optional for DMs)
    description  = db.StringField(max_length=300)
    members      = db.EmbeddedDocumentListField(ConversationMember)
    last_message = db.StringField(max_length=500, default='')
    last_sender  = db.StringField(max_length=100, default='')
    created_by   = db.ReferenceField(User)
    created_at   = db.DateTimeField(default=datetime.utcnow)
    updated_at   = db.DateTimeField(default=datetime.utcnow)

    def get_member(self, user_id):
        """Return the ConversationMember for the given user id string."""
        for m in self.members:
            if str(m.user.id) == str(user_id):
                return m
        return None

    def to_dict(self, viewer_id=None):
        unread = 0
        if viewer_id:
            m = self.get_member(viewer_id)
            unread = m.unread_count if m else 0
        return {
            "id":          str(self.id),
            "kind":        self.kind,
            "name":        self.name,
            "description": self.description,
            "members": [
                {
                    "user_id":   str(m.user.id),
                    "name":      m.user.name,
                    "branch":    m.user.branch,
                    "year":      m.user.year,
                    "is_admin":  m.is_admin,
                    "joined_at": m.joined_at.isoformat() if m.joined_at else None,
                }
                for m in self.members
            ],
            "last_message": self.last_message,
            "last_sender":  self.last_sender,
            "unread_count": unread,
            "created_at":   self.created_at.isoformat(),
            "updated_at":   self.updated_at.isoformat(),
        }


class Message(db.Document):
    """
    Individual message inside a Conversation.
    Supports real-time sync, forwarding, and multi-user deletion.
    """
    meta = {
        'collection': 'messages',
        'indexes': [
            'conversation',
            '-created_at',
            'sender',
        ]
    }

    conversation            = db.ReferenceField(Conversation, reverse_delete_rule=db.CASCADE, required=True)
    sender                  = db.ReferenceField(User, reverse_delete_rule=db.CASCADE, required=True)
    text                    = db.StringField(required=True, db_field='content')
    media_url               = db.StringField()
    status                  = db.StringField(max_length=15, default='sent')  # sent | delivered | seen
    mentions                = db.ListField(db.ReferenceField(User))           # @mentions
    forwarded               = db.BooleanField(default=False)
    deleted_for             = db.ListField(db.ReferenceField(User))           # List of users who deleted this for themselves
    is_deleted_for_everyone = db.BooleanField(default=False)
    created_at              = db.DateTimeField(default=datetime.utcnow)

    def to_dict(self):
        """
        Returns a dictionary representation of the message.
        Handles deletion logic: if is_deleted_for_everyone is true, content is replaced.
        Note: The 'deleted_for' check should be handled in the route/view layer 
        to ensure privacy based on the requesting user.
        """
        return {
            "messageId":               str(self.id),
            "chatId":                  str(self.conversation.id),
            "senderId":                str(self.sender.id),
            "senderName":              self.sender.name,
            "text":                    "This message was deleted" if self.is_deleted_for_everyone else self.text,
            "media_url":               self.media_url,
            "status":                  self.status,
            "forwarded":               self.forwarded,
            "isDeletedForEveryone":    self.is_deleted_for_everyone,
            "deletedFor":              [str(u.id) for u in (self.deleted_for or [])],
            "timestamp":               self.created_at.isoformat(),
            
            # Backward compatibility fields (optional but helpful for transition)
            "id":                      str(self.id),
            "conversation":            str(self.conversation.id),
            "sender_id":               str(self.sender.id),
            "sender_name":             self.sender.name,
            "content":                 "This message was deleted" if self.is_deleted_for_everyone else self.text,
            "media_url":               self.media_url,
            "is_deleted":              self.is_deleted_for_everyone,
            "created_at":              self.created_at.isoformat(),
        }


class ProjectReview(db.Document):
    """
    Highlighted projects with evaluation scores from the core team.
    """
    meta = {'collection': 'project_reviews'}

    name                  = db.StringField(max_length=200, required=True)
    description           = db.StringField(required=True)
    implementation_score  = db.FloatField(default=0.0)
    implementation_reason = db.StringField(default="")
    impact_score          = db.FloatField(default=0.0)
    impact_reason         = db.StringField(default="")
    working_score         = db.FloatField(default=0.0)
    working_reason        = db.StringField(default="")
    total_score           = db.FloatField(default=0.0)
    created_at            = db.DateTimeField(default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "scores": {
                "implementation": self.implementation_score,
                "impact": self.impact_score,
                "working": self.working_score,
                "total": self.total_score
            },
            "reasons": {
                "implementation": self.implementation_reason,
                "impact": self.impact_reason,
                "working": self.working_reason
            },
            "created_at": self.created_at.isoformat()
        }


class HackathonSubmission(db.Document):
    """
    Hackathon achievement submission for verification.
    """
    meta = {'collection': 'hackathon_submissions'}

    user            = db.ReferenceField(User, reverse_delete_rule=db.CASCADE, required=True)
    hackathon_name  = db.StringField(max_length=200, required=True)
    position        = db.IntField(required=True) # e.g. 1, 2, 3
    certificate_url = db.StringField(required=True)
    status          = db.StringField(max_length=20, default='pending') # pending, approved, rejected
    approvals       = db.ListField(db.ReferenceField(User)) # List of admin/reviewer IDs
    rejections      = db.ListField(db.ReferenceField(User)) # List of admin/reviewer IDs
    created_at      = db.DateTimeField(default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user.id),
            "user_name": self.user.name,
            "user_college": self.user.college,
            "hackathon_name": self.hackathon_name,
            "position": self.position,
            "certificate_url": self.certificate_url,
            "status": self.status,
            "approvals": [str(u.id) for u in self.approvals],
            "rejections": [str(u.id) for u in self.rejections],
            "created_at": self.created_at.isoformat()
        }

class Notification(db.Document):
    """
    System notifications for users/admins.
    """
    meta = {'collection': 'notifications', 'indexes': ['-created_at', 'recipient']}

    recipient   = db.ReferenceField(User, reverse_delete_rule=db.CASCADE, required=True)
    title       = db.StringField(max_length=100, required=True)
    message     = db.StringField(required=True)
    type        = db.StringField(max_length=50, default='system')
    link        = db.StringField()
    is_read     = db.BooleanField(default=False)
    created_at  = db.DateTimeField(default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "link": self.link,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat()
        }


