from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend import main
from backend.models import SmalltalkMetric, SmalltalkRequest
from backend.smalltalk import build_messages


def make_request() -> SmalltalkRequest:
    return SmalltalkRequest(
        language="de",
        location="Berlin",
        country="Deutschland",
        mode="hourly",
        metrics=[
            SmalltalkMetric(
                label="Ø Temperatur (2 m)", value="21,3 °C", kind="average"
            ),
            SmalltalkMetric(
                label="Temperatur (2 m) (Sa)", value="27,8 °C", kind="highlight"
            ),
        ],
    )


def test_build_messages_uses_target_language_and_data() -> None:
    messages = build_messages(make_request())
    assert messages[0]["role"] == "system"
    assert "German" in messages[0]["content"]
    assert "funny" in messages[0]["content"]
    user = messages[1]["content"]
    assert "Berlin" in user
    assert "Deutschland" in user
    assert "21,3 °C" in user
    assert "27,8 °C" in user
    assert "average" in user
    assert "highlight" in user


def test_build_messages_unknown_language_falls_back_to_english() -> None:
    request = make_request()
    request.language = "xx"
    messages = build_messages(request)
    assert "English" in messages[0]["content"]


def test_smalltalk_without_api_key_returns_503(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "settings",
        SimpleNamespace(deepseek_api_key=None, deepseek_model="deepseek-chat"),
    )
    client = TestClient(main.app)
    response = client.post("/api/smalltalk", json=make_request().model_dump())
    assert response.status_code == 503
