"""Smoke test for the API."""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    assert client.get("/api/health").json()["status"] == "ok"
