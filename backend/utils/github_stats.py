import requests
import os
import concurrent.futures

def evaluate_repository(repo, headers):
    """
    Evaluate a single repository for the Working Score.
    Returns the repo_score (float) or -1 if the repository is discarded.
    """
    owner = repo.get("owner", {}).get("login")
    repo_name = repo.get("name")
    if not owner or not repo_name:
        return -1
        
    # B. Commit Activity Check
    commits_url = f"https://api.github.com/repos/{owner}/{repo_name}/commits?per_page=10"
    commits_resp = requests.get(commits_url, headers=headers, timeout=8)
    if commits_resp.status_code == 200:
        commits = commits_resp.json()
        if len(commits) < 5:
            return -1  # Discard repo
    else:
        # If API fails (e.g. empty repo), discard
        return -1
        
    repo_score = 0.0

    # A. Deployment Check
    if repo.get("homepage"):
        repo_score += 4.0
        
    if len(commits) >= 10:
        repo_score += 1.0

    # C & D. Project Structure & README Check
    contents_url = f"https://api.github.com/repos/{owner}/{repo_name}/contents"
    contents_resp = requests.get(contents_url, headers=headers, timeout=8)
    if contents_resp.status_code == 200:
        contents = contents_resp.json()
        if isinstance(contents, list):
            file_names = [item.get("name", "").lower() for item in contents]
            
            # Setup files
            if any(f in file_names for f in ["package.json", "requirements.txt", "dockerfile", ".env.example"]):
                repo_score += 3.0
                
            # README check
            if "readme.md" in file_names:
                repo_score += 2.0
                
    return repo_score

def get_github_stats(username: str) -> dict:
    """
    Fetch GitHub statistics: public repos count, total stars, total commits, and working score.
    """
    stats = {
        "github_repos": 0,
        "github_stars": 0,
        "github_commits": 0,
        "working_score": 0.0
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

        # 2. Fetch Repos (for stars count and working score)
        repos_url = f"https://api.github.com/users/{username}/repos?per_page=100"
        repos_resp = requests.get(repos_url, headers=headers, timeout=10)
        
        valid_repos = []
        if repos_resp.status_code == 200:
            repos_data = repos_resp.json()
            total_stars = 0
            for repo in repos_data:
                if not repo.get("fork"):
                    total_stars += repo.get("stargazers_count", 0)
                    valid_repos.append(repo)
            stats["github_stars"] = total_stars
            
        # 2.5 Calculate Working Score in Parallel
        if valid_repos:
            repo_scores = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                futures = {executor.submit(evaluate_repository, r, headers): r for r in valid_repos}
                for future in concurrent.futures.as_completed(futures):
                    try:
                        score = future.result()
                        if score != -1:
                            repo_scores.append(score)
                    except Exception as e:
                        pass
            
            if repo_scores:
                stats["working_score"] = min(sum(repo_scores) / len(repo_scores), 10.0)
            else:
                stats["working_score"] = 0.0
        
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
    Calculate GitHub score deterministically on the backend based on repos, stars, commits, and project usability.
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

    # 2. Working Score (real project usability)
    working = stats.get("working_score", 0.0)

    # 3. Impact Score (based on stars)
    impact = 0
    if stars > 100: impact += 10
    elif stars > 50: impact += 8
    elif stars > 20: impact += 6
    elif stars > 5: impact += 4
    elif stars > 0: impact += 2
    
    impact = min(impact, 10.0)

    total = round((impl + working + impact) / 3.0, 2)

    rank = "Starter"
    if total >= 9: rank = "Elite"
    elif total >= 7: rank = "Advanced"
    elif total >= 5: rank = "Intermediate"
    elif total >= 3: rank = "Beginner"

    return {
        "github_impl": round(impl, 1),
        "github_working": round(working, 1),
        "github_impact": round(impact, 1),
        "github_score": total,
        "github_rank": rank
    }
