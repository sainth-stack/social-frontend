from __future__ import annotations

import pytest
from pydantic import ValidationError
from pymongo.errors import ServerSelectionTimeoutError

from app.core import bootstrap, seed_admin
from app.core.security import hash_password, verify_password


@pytest.fixture()
def admin_db(db, monkeypatch):
    monkeypatch.setattr(seed_admin, "get_database", lambda: db)
    return db


def test_create_admin_and_verify_password(admin_db):
    result = seed_admin.ensure_platform_admin(" Admin@Example.com ", "new-admin-password")
    user = admin_db.users.find_one({"id": result["user_id"]})
    assert user["email"] == "admin@example.com"
    assert user["is_active"] is True
    assert user["is_platform_admin"] is True
    assert user["full_name"] == "Platform Admin"
    assert user["google_id"] is None
    assert verify_password("new-admin-password", user["password_hash"])
    workspace = admin_db.workspaces.find_one({"id": result["workspace_id"]})
    assert workspace["owner_user_id"] == user["id"]
    assert workspace["name"] == "OpsBrain Admin"
    assert workspace["plan"] == "enterprise"
    assert workspace["is_active"] is True
    member = admin_db.workspace_members.find_one({"user_id": user["id"]})
    assert member["workspace_id"] == workspace["id"]
    assert member["role"] == "owner"
    assert member["social_level"] == "admin"


def test_repeated_setup_is_idempotent(admin_db):
    first = seed_admin.ensure_platform_admin("admin@example.com", "new-admin-password")
    before = {
        name: list(admin_db[name].find())
        for name in ("users", "workspaces", "workspace_members")
    }
    assert seed_admin.ensure_platform_admin("ADMIN@example.com", "new-admin-password") == first
    for name, documents in before.items():
        assert list(admin_db[name].find()) == documents


def test_existing_user_promoted_and_only_target_password_reset(admin_db):
    old_hash = hash_password("old-admin-password")
    admin_db.users.insert_many([
        {"id": "target", "email": "admin@example.com", "password_hash": old_hash,
         "full_name": "Existing Name", "is_active": False, "is_platform_admin": False},
        {"id": "other", "email": "other@example.com", "password_hash": old_hash,
         "is_active": False, "is_platform_admin": False},
    ])
    other_before = admin_db.users.find_one({"id": "other"})
    result = seed_admin.ensure_platform_admin("admin@example.com", "replacement-password")
    user = admin_db.users.find_one({"id": "target"})
    assert result["user_id"] == "target"
    assert user["full_name"] == "Existing Name"
    assert user["is_active"] is True
    assert user["is_platform_admin"] is True
    assert verify_password("replacement-password", user["password_hash"])
    assert not verify_password("old-admin-password", user["password_hash"])
    assert admin_db.users.find_one({"id": "other"}) == other_before
    assert admin_db.users.count_documents({}) == 2


@pytest.mark.parametrize("membership", ["missing", "incorrect"])
def test_repair_owned_workspace_and_membership(admin_db, membership):
    result = seed_admin.ensure_platform_admin("admin@example.com", "new-admin-password")
    admin_db.workspaces.update_one(
        {"id": result["workspace_id"]},
        {"$set": {"is_active": False, "name": "Keep Name", "plan": "growth"}},
    )
    if membership == "missing":
        admin_db.workspace_members.delete_many({})
    else:
        admin_db.workspace_members.update_one(
            {"user_id": result["user_id"]},
            {"$set": {"role": "member", "social_level": "viewer"}},
        )
    assert seed_admin.ensure_platform_admin("admin@example.com", "new-admin-password") == result
    workspace = admin_db.workspaces.find_one({"id": result["workspace_id"]})
    assert workspace["is_active"] is True
    assert workspace["name"] == "Keep Name"
    assert workspace["plan"] == "growth"
    assert admin_db.workspaces.count_documents({}) == 1
    member = admin_db.workspace_members.find_one({"user_id": result["user_id"]})
    assert member["role"] == "owner"
    assert member["social_level"] == "admin"
    assert admin_db.workspace_members.count_documents({}) == 1


def test_missing_owned_workspace_does_not_take_over_shared_workspace(admin_db):
    admin_db.users.insert_one({"id": "target", "email": "admin@example.com"})
    admin_db.workspaces.insert_one({"id": "shared", "owner_user_id": "other"})
    admin_db.workspace_members.insert_one({
        "id": "shared-member", "workspace_id": "shared", "user_id": "target",
        "role": "member", "social_level": "viewer",
    })
    shared_before = admin_db.workspaces.find_one({"id": "shared"})
    member_before = admin_db.workspace_members.find_one({"id": "shared-member"})
    result = seed_admin.ensure_platform_admin("admin@example.com", "new-admin-password")
    assert result["workspace_id"] != "shared"
    assert admin_db.workspaces.find_one({"id": "shared"}) == shared_before
    assert admin_db.workspace_members.find_one({"id": "shared-member"}) == member_before
    assert admin_db.workspaces.count_documents({"owner_user_id": "target"}) == 1


@pytest.mark.parametrize("email,password", [
    ("invalid-email", "new-admin-password"),
    ("admin@example.com", "short"),
    ("admin@example.com", "x" * 129),
])
def test_invalid_credentials_do_not_write(admin_db, email, password):
    with pytest.raises(ValidationError):
        seed_admin.ensure_platform_admin(email, password)
    for name in ("users", "workspaces", "workspace_members"):
        assert admin_db[name].count_documents({}) == 0


def test_cli_uses_config_without_prompting(admin_db, monkeypatch, capsys):
    monkeypatch.setattr(seed_admin.settings, "admin_email", "admin@example.com")
    monkeypatch.setattr(seed_admin.settings, "admin_password", "configured-password")
    monkeypatch.setattr("builtins.input", lambda _: pytest.fail("unexpected email prompt"))
    monkeypatch.setattr(seed_admin, "getpass", lambda _: pytest.fail("unexpected password prompt"))
    assert seed_admin.main() == 0
    output = capsys.readouterr()
    assert "admin@example.com" in output.out
    assert "configured-password" not in output.out + output.err


def test_cli_prompts_for_missing_config(admin_db, monkeypatch):
    monkeypatch.setattr(seed_admin.settings, "admin_email", None)
    monkeypatch.setattr(seed_admin.settings, "admin_password", None)
    monkeypatch.setattr("builtins.input", lambda _: "admin@example.com")
    monkeypatch.setattr(seed_admin, "getpass", lambda _: "prompted-password")
    assert seed_admin.main() == 0
    user = admin_db.users.find_one({"email": "admin@example.com"})
    assert verify_password("prompted-password", user["password_hash"])


def test_cli_database_failure_is_sanitized(monkeypatch, capsys):
    monkeypatch.setattr(seed_admin.settings, "admin_email", "admin@example.com")
    monkeypatch.setattr(seed_admin.settings, "admin_password", "configured-password")

    def unavailable():
        raise ServerSelectionTimeoutError("mongodb://private:secret@localhost:27017")

    monkeypatch.setattr(seed_admin, "get_database", unavailable)
    assert seed_admin.main() == 1
    output = capsys.readouterr()
    assert not output.out
    assert "MongoDB operation failed" in output.err
    assert "secret" not in output.err
    assert "configured-password" not in output.err


def test_cli_invalid_password_is_not_echoed(admin_db, monkeypatch, capsys):
    monkeypatch.setattr(seed_admin.settings, "admin_email", "admin@example.com")
    monkeypatch.setattr(seed_admin.settings, "admin_password", "short")
    assert seed_admin.main() == 1
    output = capsys.readouterr()
    assert "password:" in output.err
    assert "short" not in output.err


def test_startup_bootstrap_does_not_reset_existing_password(admin_db, monkeypatch):
    seed_admin.ensure_platform_admin("admin@example.com", "original-password")
    before = admin_db.users.find_one({"email": "admin@example.com"})
    monkeypatch.setattr(bootstrap, "get_database", lambda: admin_db)
    monkeypatch.setattr(bootstrap.settings, "admin_email", "admin@example.com")
    monkeypatch.setattr(bootstrap.settings, "admin_password", "different-password")
    bootstrap.seed_platform_admin()
    assert admin_db.users.find_one({"email": "admin@example.com"}) == before