import requests
import re

def analyze_github_profile(github_url):
    """
    Simulates an AI analysis of a GitHub profile by fetching actual repo stats 
    and generating heuristic scores out of 10.
    """
    if not github_url:
        return None
        
    # Extract username from URL
    match = re.search(r'github\.com/([^/]+)', github_url)
    if not match:
        return None
        
    username = match.group(1)
    
    try:
        # Fetch user's public repos
        resp = requests.get(f"https://api.github.com/users/{username}/repos?per_page=100", timeout=10)
        if resp.status_code != 200:
            return None
            
        repos = resp.json()
        if not repos:
            return {
                "implementation": 2.0, "impact": 1.0, "working": 2.0, "total": 1.7,
                "reason": f"Analyzed @{username}'s profile. No public repositories found."
            }
            
        original_repos = [r for r in repos if not r.get('fork', False)]
        
        # 1. Implementation Score (based on languages and repo count)
        repo_count = len(original_repos)
        langs = set(r.get('language') for r in original_repos if r.get('language'))
        impl_score = min(10.0, 4.0 + (repo_count * 0.2) + (len(langs) * 0.5))
        
        # 2. Impact Score (based on stars and forks)
        total_stars = sum(r.get('stargazers_count', 0) for r in original_repos)
        total_forks = sum(r.get('forks_count', 0) for r in original_repos)
        impact_score = 3.0 + (total_stars * 0.5) + (total_forks * 0.8)
        if total_stars > 0 or total_forks > 0:
            impact_score += 2.0 # Bonus for any community interaction
        impact_score = min(10.0, impact_score)
            
        # 3. Working Score (based on size)
        total_size = sum(r.get('size', 0) for r in original_repos) # size is in KB
        work_score = min(10.0, 5.0 + (total_size / 5000)) 
        
        # Round scores
        impl_score = round(impl_score, 1)
        impact_score = round(impact_score, 1)
        work_score = round(work_score, 1)
        
        # Calculate Total (Weighted average)
        total_score = round((impl_score * 0.4) + (impact_score * 0.3) + (work_score * 0.3), 1)
        
        # Generate AI-like reason string
        lang_str = ", ".join(list(langs)[:3]) if langs else "various technologies"
        reason = (f"AI Analysis: Scanned {repo_count} original repositories by @{username}. "
                  f"Demonstrates proficiency in {lang_str}. "
                  f"Projects have accumulated {total_stars} stars and {total_forks} forks, indicating "
                  f"{'strong' if impact_score > 6 else 'developing'} community impact. ")
                  
        return {
            "implementation": impl_score,
            "impact": impact_score,
            "working": work_score,
            "total": total_score,
            "reason": reason
        }
    except Exception as e:
        print(f"GitHub Analysis Error: {e}")
        return None
