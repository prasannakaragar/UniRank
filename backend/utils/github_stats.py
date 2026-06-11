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

    # B. Commit Activity Check — require at least 2 commits to be a real project
    commits_url = f"https://api.github.com/repos/{owner}/{repo_name}/commits?per_page=10"
    commits_resp = requests.get(commits_url, headers=headers, timeout=8)
    if commits_resp.status_code == 200:
        commits = commits_resp.json()
        if not isinstance(commits, list) or len(commits) < 2:
            return -1  # Discard empty/single-commit repos
    else:
        # If API fails (e.g. empty repo), discard
        return -1

    repo_score = 0.0

    # A. Deployment / Homepage Check
    if repo.get("homepage"):
        repo_score += 3.0

    # B2. Commit depth bonus
    if len(commits) >= 10:
        repo_score += 1.5
    elif len(commits) >= 5:
        repo_score += 0.75

    # B3. Language bonus — repo has a detected language
    if repo.get("language"):
        repo_score += 1.0

    # B4. Repo size (proxy for actual code volume)
    size = repo.get("size", 0)
    if size > 1000:
        repo_score += 1.5
    elif size > 100:
        repo_score += 0.75

    # C & D. Project Structure & README Check
    contents_url = f"https://api.github.com/repos/{owner}/{repo_name}/contents"
    contents_resp = requests.get(contents_url, headers=headers, timeout=8)
    if contents_resp.status_code == 200:
        contents = contents_resp.json()
        if isinstance(contents, list):
            file_names = [item.get("name", "").lower() for item in contents]

            # Setup / dependency files
            if any(f in file_names for f in ["package.json", "requirements.txt", "dockerfile", ".env.example", "pom.xml", "cargo.toml", "go.mod"]):
                repo_score += 2.0

            # README check
            if any(f.startswith("readme") for f in file_names):
                repo_score += 1.5

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
        
        if user_resp.status_code == 403 or user_resp.status_code == 429:
            raise Exception("GitHub API rate limit exceeded.")
            
        if user_resp.status_code == 200:
            user_data = user_resp.json()
            stats["github_repos"] = user_data.get("public_repos", 0)

        # 2. Fetch Repos (for stars count and working score)
        valid_repos = []
        total_stars = 0
        page = 1
        while True:
            repos_url = f"https://api.github.com/users/{username}/repos?per_page=100&page={page}"
            repos_resp = requests.get(repos_url, headers=headers, timeout=10)
            
            if repos_resp.status_code == 200:
                repos_data = repos_resp.json()
                if not repos_data:
                    break  # No more repos
                
                for repo in repos_data:
                    if not repo.get("fork"):
                        total_stars += repo.get("stargazers_count", 0)
                        valid_repos.append(repo)
                page += 1
            elif repos_resp.status_code in [403, 429]:
                raise Exception("GitHub API rate limit exceeded.")
            else:
                break
                
        stats["github_stars"] = total_stars
        # If public_repos from user info API somehow failed or was 0, fallback to valid_repos length
        if stats["github_repos"] == 0 and valid_repos:
            stats["github_repos"] = len(valid_repos)
            
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
        raise e
        
    return stats

def calculate_github_score(stats: dict) -> dict:
    """
    Calculate GitHub score deterministically based on repos, stars, commits, and project usability.
    All three sub-scores (implementation, working, impact) are on a 0-10 scale.
    The final github_score is the average of all three.
    """
    repos = stats.get("github_repos", 0)
    stars = stats.get("github_stars", 0)
    commits = stats.get("github_commits", 0)

    # ── 1. Implementation Score (0–10) ──────────────────────────────────
    # Measures how much code the developer has written (commit volume + repo count)
    impl = 0.0

    # Commit volume (max 6 points)
    if commits > 1000: impl += 6.0
    elif commits > 500: impl += 5.0
    elif commits > 200: impl += 4.0
    elif commits > 100: impl += 3.0
    elif commits > 50:  impl += 2.0
    elif commits > 20:  impl += 1.5
    elif commits > 5:   impl += 1.0
    elif commits > 0:   impl += 0.5

    # Repo count (max 4 points)
    if repos > 30:   impl += 4.0
    elif repos > 20: impl += 3.0
    elif repos > 10: impl += 2.5
    elif repos > 5:  impl += 2.0
    elif repos > 3:  impl += 1.5
    elif repos > 1:  impl += 1.0
    elif repos > 0:  impl += 0.5

    impl = min(impl, 10.0)

    # ── 2. Working Score (0–10) — real project usability ─────────────────
    working = min(stats.get("working_score", 0.0), 10.0)

    # ── 3. Impact Score (0–10) — community interest / reach ──────────────
    impact = 0.0

    # Stars (max 8 points)
    if stars > 500:   impact += 8.0
    elif stars > 100: impact += 6.5
    elif stars > 50:  impact += 5.0
    elif stars > 20:  impact += 3.5
    elif stars > 10:  impact += 2.5
    elif stars > 5:   impact += 2.0
    elif stars > 0:   impact += 1.0

    # Repo count as secondary impact signal (max 2 points)
    if repos > 20:   impact += 2.0
    elif repos > 10: impact += 1.5
    elif repos > 5:  impact += 1.0
    elif repos > 0:  impact += 0.5

    impact = min(impact, 10.0)

    # ── Final score: simple average of all three ──────────────────────────
    total = round((impl + working + impact) / 3.0, 2)

    rank = "Starter"
    if total >= 9:   rank = "Elite"
    elif total >= 7: rank = "Advanced"
    elif total >= 5: rank = "Intermediate"
    elif total >= 3: rank = "Beginner"

    return {
        "github_impl":    round(impl, 1),
        "github_working": round(working, 1),
        "github_impact":  round(impact, 1),
        "github_score":   total,
        "github_rank":    rank
    }
