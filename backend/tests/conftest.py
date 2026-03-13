"""
pytest conftest — shared fixtures for all backend tests.
Set TEST_DATABASE_URL env var to use a real test DB.
"""
import asyncio
import pytest


@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
