"""Cache utility for dashboard and expensive query results.

Uses Redis when available, falls back to in-memory TTL cache.

Usage:
    from app.utils.cache import cache_get, cache_set, cache_invalidate

    cached = await cache_get("dashboard:admin")
    if cached:
        return cached
    data = await expensive_query(db)
    await cache_set("dashboard:admin", data, ttl=300)
    return data
"""

import json
import time
import fnmatch
import logging
from typing import Any, Optional

from app.config import settings

logger = logging.getLogger("workforce.cache")

# ── In-memory fallback cache ──────────────────────────────────────────────────
# Dict of key → (value, expires_at)
_mem_cache: dict[str, tuple[Any, float]] = {}

_redis = None
_redis_checked = False


async def _get_redis():
    """Lazy-initialize a shared Redis connection (checked once)."""
    global _redis, _redis_checked
    if _redis is not None:
        return _redis
    if _redis_checked:
        return None
    _redis_checked = True
    try:
        from redis.asyncio import from_url
        r = from_url(settings.REDIS_URL, decode_responses=True)
        await r.ping()
        _redis = r
        logger.info("Redis connected — using Redis cache")
        return _redis
    except Exception:
        logger.info("Redis unavailable — using in-memory cache fallback")
        return None


# ── Memory cache helpers ──────────────────────────────────────────────────────

def _mem_get(key: str) -> Optional[Any]:
    entry = _mem_cache.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.monotonic() > expires_at:
        del _mem_cache[key]
        return None
    return value


def _mem_set(key: str, value: Any, ttl: int) -> None:
    _mem_cache[key] = (value, time.monotonic() + ttl)


def _mem_delete(*keys: str) -> int:
    count = 0
    for k in keys:
        if k in _mem_cache:
            del _mem_cache[k]
            count += 1
    return count


def _mem_delete_pattern(pattern: str) -> int:
    to_delete = [k for k in _mem_cache if fnmatch.fnmatch(k, pattern)]
    for k in to_delete:
        del _mem_cache[k]
    return len(to_delete)


# ── Public API ────────────────────────────────────────────────────────────────

async def cache_get(key: str) -> Optional[Any]:
    """Get a cached value. Returns None on cache miss."""
    try:
        redis = await _get_redis()
        if redis:
            raw = await redis.get(f"wfp:{key}")
            if raw is None:
                return None
            return json.loads(raw)
    except Exception:
        logger.debug("Redis get failed for key=%s, trying memory", key)

    # Fallback to in-memory
    return _mem_get(key)


async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Set a cached value with TTL in seconds."""
    try:
        redis = await _get_redis()
        if redis:
            serialized = json.dumps(value, default=str)
            await redis.set(f"wfp:{key}", serialized, ex=ttl)
            return True
    except Exception:
        logger.debug("Redis set failed for key=%s, using memory", key)

    # Fallback to in-memory
    _mem_set(key, value, ttl)
    return True


async def cache_invalidate(*keys: str) -> int:
    """Delete one or more cache keys."""
    deleted = 0
    try:
        redis = await _get_redis()
        if redis:
            full_keys = [f"wfp:{k}" for k in keys]
            deleted = await redis.delete(*full_keys)
    except Exception:
        pass

    # Also clear from memory
    deleted += _mem_delete(*keys)
    return deleted


async def cache_invalidate_pattern(pattern: str) -> int:
    """Delete all cache keys matching a pattern (e.g., 'dashboard:*')."""
    deleted = 0
    try:
        redis = await _get_redis()
        if redis:
            cursor = 0
            full_pattern = f"wfp:{pattern}"
            while True:
                cursor, keys = await redis.scan(cursor, match=full_pattern, count=100)
                if keys:
                    deleted += await redis.delete(*keys)
                if cursor == 0:
                    break
    except Exception:
        pass

    # Also clear from memory
    deleted += _mem_delete_pattern(pattern)
    return deleted
