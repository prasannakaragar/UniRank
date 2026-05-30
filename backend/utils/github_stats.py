import requests
import os

def get_github_stats(username: str) -> dict:
    """
    Fetch GitHub statistics: public repos count, total stars, and total commits.
    """
    stats = {
        "github_repos": 0,
        "github_stars": 0,
        "github_commits": 0
    }
    if not username:
        return stats

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/vnd.github.v3+json"
    }
    
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"

    try:
        # 1. Fetch User Info (for repos count)
        user_url = f"https://api.github.com/users/{username}"
        user_resp = requests.get(user_url, headers=headers, timeout=8)
        if user_resp.status_code == 200:
            user_data = user_resp.json()
            stats["github_repos"] = user_data.get("public_repos", 0)

        # 2. Fetch Repos (for stars count)
        repos_url = f"https://api.github.com/users/{username}/repos?per_page=100"
        repos_resp = requests.get(repos_url, headers=headers, timeout=10)
        if repos_resp.status_code == 200:
            repos_data = repos_resp.json()
            total_stars = sum(repo.get("stargazers_count", 0) for repo in repos_data if not repo.get("fork"))
            stats["github_stars"] = total_stars
        
        # 3. Fetch Commits using Search Commits API
        commit_headers = {**headers, "Accept": "application/vnd.github.cloak-preview+json"}
        search_url = f"https://api.github.com/search/commits?q=author:{username}"
        search_resp = requests.get(search_url, headers=commit_headers, timeout=10)
        if search_resp.status_code == 200:
            search_data = search_resp.json()
            stats["github_commits"] = search_data.get("total_count", 0)
        else:
            # Fallback estimation if rate limited or search fails:
            events_url = f"https://api.github.com/users/{username}/events/public?per_page=100"
            events_resp = requests.get(events_url, headers=headers, timeout=8)
            if events_resp.status_code == 200:
                events = events_resp.json()
                push_commits = 0
                for event in events:
                    if event.get("type") == "PushEvent":
                        payload = event.get("payload", {})
                        push_commits += len(payload.get("commits", []))
                stats["github_commits"] = max(push_commits, stats["github_repos"] * 5)
            else:
                stats["github_commits"] = stats["github_repos"] * 5
                
    except Exception as e:
        print(f"Error fetching GitHub stats: {e}")
        
    return stats

def calculate_github_score(stats: dict) -> dict:
    """
    Calculate GitHub score deterministically on the backend based on repos, stars, and commits.
    This replaces the client-side heuristic.
    """
    repos = stats.get("github_repos", 0)
    stars = stats.get("github_stars", 0)
    commits = stats.get("github_commits", 0)

    # 1. Implementation Score
    impl = 0
    if commits > 500: impl += 4
    elif commits > 100: impl += 3
    elif commits > 50: impl += 2
    elif commits > 10: impl += 1
    
    if repos > 20: impl += 3
    elif repos > 10: impl += 2
    elif repos > 5: impl += 1

    impl = min(impl + (repos * 0.1), 10.0)

    # 2. Working Score (proxy based on activity density)
    working = min((commits / max(repos, 1)) * 0.5 + (repos * 0.2), 10.0)

    # 3. Impact Score (based on stars)
    impact = 0
    if stars > 100: impact += 10
    elif stars > 50: impact += 8
    elif stars > 20: impact += 6
    elif stars > 5: impact += 4
    elif stars > 0: impact += 2
    
    impact = min(impact, 10.0)

    total = (impl + working + impact) / 3.0

    rank = "Starter"
    if total >= 9: rank = "Elite"
    elif total >= 7: rank = "Advanced"
    elif total >= 5: rank = "Intermediate"
    elif total >= 3: rank = "Beginner"

    return {
        "github_impl": round(impl, 1),
        "github_working": round(working, 1),
        "github_impact": round(impact, 1),
        "github_score": round(total, 1),
        "github_rank": rank
    }
