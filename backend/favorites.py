from __future__ import annotations

import json
import threading
from pathlib import Path

from pydantic import ValidationError

from .models import Favorite


def favorite_id(latitude: float, longitude: float) -> str:
    return f"{latitude:.4f},{longitude:.4f}"


class FavoritesStore:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()

    def _read(self) -> list[Favorite]:
        if not self._path.exists():
            return []
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
        if not isinstance(raw, list):
            return []
        favorites: list[Favorite] = []
        for item in raw:
            try:
                favorites.append(Favorite.model_validate(item))
            except ValidationError:
                continue
        return favorites

    def _write(self, favorites: list[Favorite]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = [favorite.model_dump() for favorite in favorites]
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def list(self) -> list[Favorite]:
        with self._lock:
            return self._read()

    def add(self, favorite: Favorite) -> list[Favorite]:
        with self._lock:
            favorites = self._read()
            if not any(existing.id == favorite.id for existing in favorites):
                favorites.append(favorite)
                self._write(favorites)
            return favorites

    def remove(self, favorite_id_value: str) -> list[Favorite]:
        with self._lock:
            favorites = [f for f in self._read() if f.id != favorite_id_value]
            self._write(favorites)
            return favorites

    def reorder(self, ids: list[str]) -> list[Favorite]:
        with self._lock:
            favorites = self._read()
            by_id = {favorite.id: favorite for favorite in favorites}
            ordered = [by_id[favorite_id_value] for favorite_id_value in ids if favorite_id_value in by_id]
            remaining = [favorite for favorite in favorites if favorite.id not in set(ids)]
            result = ordered + remaining
            self._write(result)
            return result
