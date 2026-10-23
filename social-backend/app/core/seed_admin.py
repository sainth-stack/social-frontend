from __future__ import annotations

import sys
import warnings
from getpass import GetPassWarning, getpass

from pydantic import ValidationError
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from app.auth.schemas import RegisterRequest
from app.core.config import settings
from app.core.database import get_database
from app.core.mongo_utils import new_id, utcnow
from app.core.security import hash_password, verify_password


def ensure_platform_admin(email: str, password: str) -> dict[str, str]:
    credentials = RegisterRequest(email=email.strip().lower(), password=password)
    email = str(credentials.email).lower()
    db = get_database()
    now = utcnow()
    existing = db["users"].find_one({"email": email})
    password_matches = False
    if existing and existing.get("password_hash"):
        try:
            password_matches = verify_password(password, existing["password_hash"])
        except (ValueError, TypeError):
            pass
    updates = {"is_active": True, "is_platform_admin": True}
    if not password_matches:
        updates["password_hash"] = hash_password(password)
    if not existing or any(existing.get(key) != value for key, value in updates.items()):
        updates["updated_at"] = now
    user = db["users"].find_one_and_update(
        {"email": email},
        {
            "$set": updates,
            "$setOnInsert": {
                "id": new_id(),
                "full_name": "Platform Admin",
                "google_id": None,
                "created_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    workspace = db["workspaces"].find_one({"owner_user_id": user["id"]})
    if workspace is None:
        workspace = {
            "id": new_id(),
            "name": "OpsBrain Admin",
            "plan": "enterprise",
            "owner_user_id": user["id"],
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        db["workspaces"].insert_one(workspace)
    elif not workspace.get("is_active"):
        db["workspaces"].update_one(
            {"id": workspace["id"], "owner_user_id": user["id"]},
            {"$set": {"is_active": True, "updated_at": now}},
        )
    db["workspace_members"].update_one(
        {"user_id": user["id"], "workspace_id": workspace["id"]},
        {
            "$set": {"role": "owner", "social_level": "admin"},
            "$setOnInsert": {"id": new_id(), "created_at": now},
        },
        upsert=True,
    )
    return {"email": email, "user_id": user["id"], "workspace_id": workspace["id"]}


def main() -> int:
    try:
        email = settings.admin_email or input("Admin email: ")
        password = settings.admin_password
        if not password:
            with warnings.catch_warnings():
                warnings.simplefilter("error", GetPassWarning)
                password = getpass("Admin password (sets/resets only this email): ")
        result = ensure_platform_admin(email, password)
    except ValidationError as exc:
        errors = "; ".join(
            f"{'.'.join(map(str, error['loc']))}: {error['msg']}"
            for error in exc.errors(include_input=False, include_url=False)
        )
        print(f"Invalid admin credentials: {errors}", file=sys.stderr)
        return 1
    except PyMongoError:
        print(
            "Admin setup failed: MongoDB operation failed. Check MONGODB_URL, "
            "MONGODB_DB_NAME, connectivity, and database permissions; then rerun. "
            "Setup may be incomplete.",
            file=sys.stderr,
        )
        return 1
    except (EOFError, KeyboardInterrupt, GetPassWarning):
        print("Admin setup cancelled: secure input unavailable or interrupted.", file=sys.stderr)
        return 1
    print(f"Platform admin ready: {result['email']}; password set for this email only.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())