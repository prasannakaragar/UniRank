import requests
import re
import json
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# We configure the Gemini API using an environment variable
# Gemini offers a completely free tier.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    
def analyze_github_profile(github_url):
    """
    Scans a user's GitHub repositories and uses Gemini AI to evaluate them.
    Returns a dict with implementation, impact, working, total scores and a reason.
    """
    if not github_url:
        return None
        
    if not GEMINI_API_KEY:
        # Fallback to the heuristic scoring if no Free Gemini Key is provided
        return analyze_github_profile_heuristic(github_url)
        
    match = re.search(r'github\.com/([^/]+)', github_url)
    if not match:
        return None
        
    username = match.group(1)
        
    try:
        # 1. Fetch public repositories using GitHub API
        repos_url = f"https://api.github.com/users/{username}/repos?per_page=30&sort=updated"
        response = requests.get(repos_url, timeout=15)
        
        if response.status_code != 200:
            return None
            
        repos = response.json()
        if not repos:
            return {
                "implementation": 0.0,
                "impact": 0.0,
                "working": 0.0,
                "total": 0.0,
                "reason": "Analyzed successfully. No public repositories found."
            }
            
        # 2. Extract relevant data to feed to the AI
        repo_summaries = []
        for r in repos:
            if not r.get('fork'): # only count their own repos
                repo_summaries.append({
                    "name": r.get("name"),
                    "description": r.get("description"),
                    "language": r.get("language"),
                    "stars": r.get("stargazers_count"),
                    "forks": r.get("forks_count"),
                    "topics": r.get("topics", [])
                })
                
        if not repo_summaries:
            return {
                "implementation": 0.0,
                "impact": 0.0,
                "working": 0.0,
                "total": 0.0,
                "reason": "Only forked repositories found. AI requires original work to analyze."
            }

        # 3. Feed the data to Gemini AI
        prompt = f"""
        You are an expert Senior Software Engineer AI. I am going to provide you with a list of GitHub repositories belonging to a student.
        
        Repositories Data:
        {json.dumps(repo_summaries, indent=2)}
        
        Based on these repositories (their descriptions, tech stacks, stars, and complexities), evaluate this developer on three metrics (each strictly on a scale of 0.0 to 10.0):
        1. implementation: How complex/well-architected the projects seem based on their tech stack and descriptions.
        2. impact: How useful or impactful the projects are (consider stars, forks, and the problem it solves).
        3. working: Assume functionality based on tech stack diversity and project maturity.
        
        Calculate the average of these three as the 'total' score.
        Also provide a short 1-2 sentence 'reason' explaining the assessment.
        
        You MUST return ONLY a raw JSON object with the following exact keys and format. Do NOT wrap it in markdown block quotes (like ```json). Just return the JSON:
        {{
            "implementation": 7.5,
            "impact": 6.0,
            "working": 8.0,
            "total": 7.1,
            "reason": "Solid use of React and Python, solving practical problems, though impact is moderate."
        }}
        """
        
        model = genai.GenerativeModel('gemini-1.5-flash')
        result = model.generate_content(prompt)
        text_response = result.text.strip()
        
        # Clean up in case the AI wraps it in markdown anyway
        if text_response.startswith("```json"):
            text_response = text_response[7:]
        if text_response.startswith("```"):
            text_response = text_response[3:]
        if text_response.endswith("```"):
            text_response = text_response[:-3]
            
        data = json.loads(text_response.strip())
        
        imp = float(data.get("implementation", 0.0))
        impact = float(data.get("impact", 0.0))
        work = float(data.get("working", 0.0))
        total = round((imp + impact + work) / 3, 1)
        
        return {
            "implementation": round(imp, 1),
            "impact": round(impact, 1),
            "working": round(work, 1),
            "total": total,
            "reason": data.get("reason", "Analyzed successfully by Gemini AI.")
        }
        
    except Exception as e:
        print(f"Gemini AI Analysis Error: {e}")
        return analyze_github_profile_heuristic(github_url)


def analyze_github_profile_heuristic(github_url):
    """
    Fallback simulated heuristic scoring if no API key is present or AI fails.
    """
    match = re.search(r'github\.com/([^/]+)', github_url)
    if not match:
        return None
    username = match.group(1)
    
    try:
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
        
        repo_count = len(original_repos)
        langs = set(r.get('language') for r in original_repos if r.get('language'))
        impl_score = min(10.0, 4.0 + (repo_count * 0.2) + (len(langs) * 0.5))
        
        total_stars = sum(r.get('stargazers_count', 0) for r in original_repos)
        total_forks = sum(r.get('forks_count', 0) for r in original_repos)
        impact_score = 3.0 + (total_stars * 0.5) + (total_forks * 0.8)
        if total_stars > 0 or total_forks > 0:
            impact_score += 2.0
        impact_score = min(10.0, impact_score)
            
        total_size = sum(r.get('size', 0) for r in original_repos)
        work_score = min(10.0, 5.0 + (total_size / 5000)) 
        
        impl_score = round(impl_score, 1)
        impact_score = round(impact_score, 1)
        work_score = round(work_score, 1)
        
        total_score = round((impl_score + impact_score + work_score) / 3, 1)
        
        lang_str = ", ".join(list(langs)[:3]) if langs else "various technologies"
        reason = (f"Heuristic Analysis: Scanned {repo_count} original repositories by @{username}. "
                  f"Demonstrates proficiency in {lang_str}. ")
                  
        return {
            "implementation": impl_score,
            "impact": impact_score,
            "working": work_score,
            "total": total_score,
            "reason": reason
        }
    except Exception as e:
        print(f"Fallback Analysis Error: {e}")
        return None
