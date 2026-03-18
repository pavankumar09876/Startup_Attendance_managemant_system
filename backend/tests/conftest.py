"""
pytest conftest — shared fixtures for all backend tests.
"""
import asyncio
import pytest


@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for the whole test session."""
    policy = asyncio.DefaultEventLoopPolicy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()
