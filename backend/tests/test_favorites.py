from __future__ import annotations

from pathlib import Path

from backend.favorites import FavoritesStore, favorite_id
from backend.models import Favorite


def make_favorite(name: str, latitude: float, longitude: float) -> Favorite:
    return Favorite(
        id=favorite_id(latitude, longitude),
        name=name,
        latitude=latitude,
        longitude=longitude,
    )


def test_add_and_list(tmp_path: Path) -> None:
    store = FavoritesStore(tmp_path / "favorites.json")
    assert store.list() == []

    berlin = make_favorite("Berlin", 52.5244, 13.4105)
    result = store.add(berlin)

    assert [f.name for f in result] == ["Berlin"]
    assert store.list()[0].id == "52.5244,13.4105"


def test_duplicate_is_ignored(tmp_path: Path) -> None:
    store = FavoritesStore(tmp_path / "favorites.json")
    store.add(make_favorite("Berlin", 52.5244, 13.4105))
    store.add(make_favorite("Berlin", 52.5244, 13.4105))

    assert len(store.list()) == 1


def test_remove(tmp_path: Path) -> None:
    store = FavoritesStore(tmp_path / "favorites.json")
    berlin = make_favorite("Berlin", 52.5244, 13.4105)
    paris = make_favorite("Paris", 48.8566, 2.3522)
    store.add(berlin)
    store.add(paris)

    result = store.remove(berlin.id)

    assert [f.name for f in result] == ["Paris"]


def test_reorder_keeps_unknown_entries_at_the_end(tmp_path: Path) -> None:
    store = FavoritesStore(tmp_path / "favorites.json")
    a = make_favorite("A", 1.0, 1.0)
    b = make_favorite("B", 2.0, 2.0)
    c = make_favorite("C", 3.0, 3.0)
    store.add(a)
    store.add(b)
    store.add(c)

    result = store.reorder([c.id, "does-not-exist", a.id])

    assert [f.name for f in result] == ["C", "A", "B"]


def test_persistence_across_instances(tmp_path: Path) -> None:
    path = tmp_path / "favorites.json"
    FavoritesStore(path).add(make_favorite("Berlin", 52.5244, 13.4105))

    reloaded = FavoritesStore(path).list()

    assert [f.name for f in reloaded] == ["Berlin"]


def test_corrupt_file_yields_empty_list(tmp_path: Path) -> None:
    path = tmp_path / "favorites.json"
    path.write_text("{ not valid json", encoding="utf-8")

    assert FavoritesStore(path).list() == []
