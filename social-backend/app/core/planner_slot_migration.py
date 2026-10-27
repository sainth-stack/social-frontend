from __future__ import annotations

import argparse
import json


POST_KEYS = [("workspace_id", 1), ("post_id", 1)]
LOOKUP_KEYS = [("workspace_id", 1), ("account_id", 1), ("scheduled_at", 1)]
POST_INDEX = "planner_workspace_post_unique"
LOOKUP_INDEX = "planner_account_instant_lookup"


def preflight(db):
    collection = db.social_planner_slots
    indexes = collection.index_information()
    legacy = [name for name, spec in indexes.items() if spec.get("unique") and
        set(spec["key"]) == set(LOOKUP_KEYS)]
    errors = []
    seen = set()
    for row in collection.find({}):
        workspace, post = row.get("workspace_id"), row.get("post_id")
        if not isinstance(workspace, str) or not workspace or not isinstance(post, str) or not post:
            errors.append("reservation_missing_workspace_or_post")
            continue
        key = (workspace, post)
        if key in seen:
            errors.append("duplicate_workspace_post_reservation")
        seen.add(key)
    for name, keys, unique in ((POST_INDEX, POST_KEYS, True), (LOOKUP_INDEX, LOOKUP_KEYS, False)):
        spec = indexes.get(name)
        if spec and (list(spec["key"]) != keys or bool(spec.get("unique")) != unique or
                spec.get("sparse") or spec.get("partialFilterExpression") or spec.get("collation")):
            errors.append(f"incompatible_index:{name}")
    return {"reservationCount": collection.count_documents({}), "legacyIndexes": sorted(legacy),
        "errors": sorted(set(errors))}


def migrate(db, *, apply=False, writers_stopped=False):
    report = preflight(db)
    if not apply:
        return {**report, "applied": False}
    if not writers_stopped:
        raise ValueError("Stop planner API, scheduler and publishing writers before applying this migration")
    if report["errors"]:
        raise ValueError("Planner reservation preflight failed: " + ", ".join(report["errors"]))
    collection = db.social_planner_slots
    collection.create_index(POST_KEYS, unique=True, name=POST_INDEX)
    collection.create_index(LOOKUP_KEYS, name=LOOKUP_INDEX)
    checked = preflight(db)
    if checked["errors"] or checked["reservationCount"] != report["reservationCount"]:
        raise ValueError("Reservations changed during migration; legacy indexes retained")
    for name in checked["legacyIndexes"]:
        collection.drop_index(name)
    return {**preflight(db), "applied": True, "removedIndexes": checked["legacyIndexes"]}


def main():
    parser = argparse.ArgumentParser(description="Preflight planner reservation indexes; no writes unless --apply")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--writers-stopped", action="store_true")
    args = parser.parse_args()
    from app.core.database import get_database

    report = migrate(get_database(), apply=args.apply, writers_stopped=args.writers_stopped)
    print(json.dumps(report, sort_keys=True))
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()