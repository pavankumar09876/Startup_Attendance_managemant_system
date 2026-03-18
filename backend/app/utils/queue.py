"""
Queue helper — enqueue background tasks via ARQ.

Usage in routers:
    from app.utils.queue import enqueue
    await enqueue("task_send_email", to_email="...", subject="...", ...)
"""
from arq import create_pool
from arq.connections import RedisSettings
from app.config import settings
from typing import Any

_pool = None


def _parse_redis_url(url: str) -> RedisSettings:
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
        database=int(parsed.path.lstrip("/") or 0),
    )


async def get_pool():
    """Get or create the shared ARQ Redis pool."""
    global _pool
    if _pool is None:
        _pool = await create_pool(_parse_redis_url(settings.REDIS_URL))
    return _pool


async def enqueue(task_name: str, **kwargs: Any):
    """Enqueue a background task.

    Args:
        task_name: Name of the task function (e.g. "task_send_email").
        **kwargs: Arguments passed to the task function.

    Returns:
        The ARQ Job object, or None if Redis is unavailable.
    """
    try:
        pool = await get_pool()
        job = await pool.enqueue_job(task_name, **kwargs)
        return job
    except Exception:
        # If Redis is down, log and continue — don't break the API
        import logging
        logging.getLogger("arq.queue").warning(
            f"Failed to enqueue {task_name}, Redis may be unavailable",
            exc_info=True,
        )
        return None
