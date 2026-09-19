from __future__ import annotations

import json

import httpx

from .config import DEEPSEEK_API_URL, DEEPSEEK_TIMEOUT_SECONDS
from .models import SmalltalkRequest

LANGUAGE_NAMES: dict[str, str] = {
    "de": "German",
    "en": "English",
    "fr": "French",
    "es": "Spanish",
    "it": "Italian",
}

SYSTEM_PROMPT = (
    "You are a witty, humorous weather small-talk generator. "
    "You are given a place and a handful of weather figures (averages and daily "
    "highlights) for the coming days. Write ONE short, funny, casual opener of at "
    "most 25 words in {language} that someone could use to start a light "
    "conversation. Mention the place naturally and lean into whatever stands out "
    "most (heat, rain, wind, sunshine, cold, gloom). Be playful and a little "
    "exaggerated, but keep it plausible. No greeting formulas, no emoji, no "
    "markdown, no quotes. Return only the sentence."
)


def build_messages(request: SmalltalkRequest) -> list[dict[str, str]]:
    language = LANGUAGE_NAMES.get(request.language, "English")
    place = ", ".join(
        part for part in [request.location, request.admin1, request.country] if part
    )
    data = {
        "place": place,
        "view": request.mode,
        "metrics": [
            {"label": metric.label, "value": metric.value, "kind": metric.kind}
            for metric in request.metrics
        ],
    }
    return [
        {"role": "system", "content": SYSTEM_PROMPT.format(language=language)},
        {
            "role": "user",
            "content": "Place and weather data as JSON:\n"
            + json.dumps(data, ensure_ascii=False),
        },
    ]


async def generate_smalltalk(
    client: httpx.AsyncClient,
    request: SmalltalkRequest,
    *,
    api_key: str,
    model: str,
) -> str:
    response = await client.post(
        DEEPSEEK_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": build_messages(request),
            "temperature": 1.15,
            "max_tokens": 90,
            "stream": False,
        },
        timeout=DEEPSEEK_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    try:
        text = payload["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError, AttributeError) as exc:
        raise ValueError("Unerwartete Antwort von DeepSeek") from exc
    if not text:
        raise ValueError("Leere Antwort von DeepSeek")
    return text
