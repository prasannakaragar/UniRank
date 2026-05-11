"""
utils/hackerrank.py
Fetches user statistics from HackerRank using their internal REST API.
"""
import requests

HACKERRANK_PROFILE_URL = "https://www.hackerrank.com/rest/contests/master/users/{username}/profile"

def get_hackerrank_stats(username: str) -> dict | None:
    """
    Fetch user's total score and rank from HackerRank.
    """
    url = HACKERRANK_PROFILE_URL.format(username=username)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    }
    
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        
        if resp.status_code != 200:
            print(f"HackerRank API returned status {resp.status_code}")
            return None
            
        data = resp.json()
        model = data.get("model", {})
        
        if not model:
            return None
            
        # HackerRank has multiple scores for different tracks. 
        # We'll try to aggregate or pick the primary ones.
        # For simplicity, let's take the 'total_count' or specific badges if available.
        # However, the profile REST API gives 'score' and 'rank' in some fields.
        
        return {
            "hr_score": int(model.get("total_score", 0)),
            "hr_rank": model.get("rank", 0),
        }
        
    except Exception as e:
        print(f"Error fetching HackerRank stats for {username}: {e}")
        return None

def sync_hackerrank_stats(username: str) -> dict:
    """
    Returns a dict ready to update the Profile model.
    """
    stats = get_hackerrank_stats(username)
    return stats if stats else {}
