import { MOCK_AUTH_STORAGE_KEY, MOCK_UI_ENABLED } from "@/lib/mock-ui/config";

export const AUTH_STORAGE_KEY = MOCK_UI_ENABLED ? MOCK_AUTH_STORAGE_KEY : "opsbrain_auth";
/** Default seeded platform admin (see `social-backend/scripts/seed_superadmin.sh`). */
export const SUPER_ADMIN_EMAIL = "superadmin@gmail.com";
