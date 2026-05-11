from mongoengine import connect
from models import User, Profile
from utils.scoring import update_user_scores
import os
from dotenv import load_dotenv

load_dotenv()

connect(host=os.getenv("MONGO_URI", "mongodb://localhost:27017/unirank"))

def apply_github_analysis():
    # Identify the main student (usually the first one seeded)
    user = User.objects(role="student").first()
    if not user:
        print("No student found.")
        return

    profile = Profile.objects(user=user).first()
    if not profile:
        print(f"No profile for user {user.name}")
        return

    print(f"Applying GitHub analysis to {user.name}...")
    
    profile.github_impl_score = 9.0
    profile.github_imp_score = 8.5
    profile.github_work_score = 9.0
    profile.github_total_score = 8.8
    profile.github_review_reason = "Exceptional full-stack architecture with a focus on security and scalability. Strong use of modern frameworks and clean code principles."
    profile.save()

    # Recalculate global score
    update_user_scores(user.id)
    print(f"Analysis applied! {user.name} now has a GitHub score of 8.8 and an updated global rank.")

if __name__ == "__main__":
    apply_github_analysis()
