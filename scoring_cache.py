"""
scoring_cache.py
SQLite response cache using WAL mode for thread safety.
"""

import hashlib
import os
import sqlite3
import datetime
from typing import Optional, Dict, Any


class ScoringCache:
    def __init__(self, db_path: str = ".cache/scoring_cache.sqlite", enabled: bool = True):
        self.db_path = db_path
        self.enabled = enabled

        if self.enabled:
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
            self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA journal_mode=WAL;")
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scoring_cache (
                    cache_key TEXT PRIMARY KEY,
                    prompt_id TEXT,
                    scoring_version TEXT,
                    cached_response TEXT,
                    created_at TEXT
                );
                """
            )
            conn.commit()

    @staticmethod
    def compute_cache_key(
        model_name: str,
        scoring_version: str,
        prompt_id: str,
        prompt_text: str,
        json_payload: str,
    ) -> str:
        """
        Calculates deterministic SHA256 cache key.
        Includes model name, scoring version, prompt ID, hash of prompt text, and hash of payload.
        """
        prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()
        payload_hash = hashlib.sha256(json_payload.encode("utf-8")).hexdigest()

        composite_string = f"{model_name}:{scoring_version}:{prompt_id}:{prompt_hash}:{payload_hash}"
        return hashlib.sha256(composite_string.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[str]:
        if not self.enabled:
            return None
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT cached_response FROM scoring_cache WHERE cache_key = ?;",
                    (key,),
                )
                row = cursor.fetchone()
                return row[0] if row else None
        except Exception:
            return None

    def set(self, key: str, prompt_id: str, scoring_version: str, response_text: str):
        if not self.enabled:
            return
        try:
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            with self._get_connection() as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO scoring_cache (cache_key, prompt_id, scoring_version, cached_response, created_at)
                    VALUES (?, ?, ?, ?, ?);
                    """,
                    (key, prompt_id, scoring_version, response_text, now_iso),
                )
                conn.commit()
        except Exception:
            pass
