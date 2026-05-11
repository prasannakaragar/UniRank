"""
utils/codeforces.py
Wrapper around the public Codeforces REST API.
Docs: https://codeforces.com/apiHelp
"""
import requests

CF_BASE = "https://codeforces.com/api"


def get_user_info(handle: str) -> dict | None:
    """
    Fetch user rating, max rating, rank, and avatar from Codeforces.
    Returns None if the handle does not exist or API is unreachable.
    """
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(f"{CF_BASE}/user.info", params={"handles": handle}, headers=headers, timeout=8)
        data = resp.json()
        if data.get("status") != "OK":
            return None
        user = data["result"][0]
        return {
            "cf_rating": user.get("rating", 0),
            "cf_max_rating": user.get("maxRating", 0),
            "cf_rank": user.get("rank", "unrated"),
            "avatar_url": user.get("avatar", None),
        }
    except Exception:
        return None


def get_problems_solved(handle: str) -> int:
    """
    Count unique problems solved by a user using their submission history.
    Only counts 'OK' (Accepted) verdicts, deduplicates by problem ID.
    """
    try:
        resp = requests.get(
            f"{CF_BASE}/user.status",
            params={"handle": handle, "from": 1, "count": 10000},
            timeout=15,
        )
        data = resp.json()
        if data.get("status") != "OK":
            return 0

        solved = set()
        for sub in data["result"]:
            if sub.get("verdict") == "OK":
                p = sub["problem"]
                solved.add((p["contestId"], p["index"]))
        return len(solved)
    except Exception:
        return 0


def sync_user_stats(handle: str) -> dict:
    """
    Combine get_user_info + get_problems_solved into a single call.
    Returns a dict ready to update the Profile model.
    """
    info = get_user_info(handle) or {}
    problems = get_problems_solved(handle)
    return {**info, "cf_problems_solved": problems}
