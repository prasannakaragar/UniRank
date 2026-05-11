from models import db, User, Profile, Announcement, TeamPost, HackathonResult
from flask import current_app

def update_user_scores(user_id):
    """
    Recalculates cached scores for a specific user.
    """
    user = User.objects(id=user_id).first()
    if not user:
        return

    profile = Profile.objects(user=user).first()
    if not profile:
        return

    # 1. Hackathon Score
    h_results = HackathonResult.objects(user=user)
    hackathon_score = sum(res.points for res in h_results)
    profile.hackathon_score = hackathon_score

    # 2. Activity Score
    announcements_count = Announcement.objects(author=user).count()
    team_posts_count = TeamPost.objects(author=user).count()
    activity_score = (announcements_count * 10) + (team_posts_count * 5)
    profile.activity_score = activity_score

    # 3. Global Score Calculation
    cp_score = (profile.cf_rating + profile.lc_rating) / 2.0
    profile.cp_score = round(cp_score, 2)

    cp_component = (profile.cf_rating / 10.0) + (profile.cf_problems_solved * 0.1) + \
                   (profile.lc_rating / 10.0) + (profile.lc_problems_solved * 0.1)
    
    # GitHub Portfolio Component (Bonus for analyzed projects)
    github_component = profile.github_total_score * 5.0
    
    global_score = cp_component + (hackathon_score * 1.5) + activity_score + github_component
    
    profile.global_score = round(global_score, 2)
    profile.save()

    # Clear leaderboard cache since scores changed
    try:
        if current_app and hasattr(current_app, 'cache'):
            current_app.cache.clear() # Simple approach: clear all
    except RuntimeError:
        pass # Outside app context
