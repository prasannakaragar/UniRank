"""
utils/leetcode.py
Fetches user statistics and contest ratings from LeetCode using their GraphQL API.
"""
import requests

LEETCODE_URL = "https://leetcode.com/graphql"

def get_leetcode_stats(username: str) -> dict | None:
    """
    Fetch user's total problems solved and contest rating.
    """
    query = """
    query userStats($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
      userContestRanking(username: $username) {
        rating
        globalRanking
        topPercentage
      }
    }
    """
    
    try:
        payload = {
            "query": query,
            "variables": {"username": username}
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Referer": "https://leetcode.com/",
            "Content-Type": "application/json",
        }
        resp = requests.post(LEETCODE_URL, json=payload, headers=headers, timeout=10)
        
        if resp.status_code != 200:
            print(f"LeetCode API returned status {resp.status_code}")
            return None
            
        data = resp.json()
        
        if "errors" in data:
            print(f"LeetCode API returned errors: {data['errors']}")
            return None
            
        result = data.get("data", {})
        matched_user = result.get("matchedUser")
        contest_ranking = result.get("userContestRanking")
        
        if not matched_user:
            return None
            
        # Get total problems solved
        stats = matched_user.get("submitStatsGlobal", {}).get("acSubmissionNum", [])
        total_solved = 0
        for item in stats:
            if item["difficulty"] == "All":
                total_solved = item["count"]
                break
                
        # Get contest rating and global rank
        rating = 0
        global_rank = 0
        if contest_ranking:
            rating = int(contest_ranking.get("rating", 0))
            global_rank = contest_ranking.get("globalRanking", 0)
            
        return {
            "lc_problems_solved": total_solved,
            "lc_rating": rating,
            "lc_rank": global_rank,
            "lc_max_rating": rating # LeetCode doesn't easily expose max rating in this query, we'll use current for now
        }
        
    except Exception as e:
        print(f"Error fetching LeetCode stats for {username}: {e}")
        return None

def sync_leetcode_stats(username: str) -> dict:
    """
    Returns a dict ready to update the Profile model.
    """
    stats = get_leetcode_stats(username)
    return stats if stats else {}
