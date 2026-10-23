import type {
  ApiUserRaw,
  ApiWorkspaceSummary,
  MeResponse,
  PlanTier,
  RegisterResponse,
  SocialPermissionLevel,
  User,
} from "@/types/auth";

const PLAN_TIERS: PlanTier[] = ["starter", "growth", "enterprise"];
const SOCIAL_LEVELS: SocialPermissionLevel[] = ["viewer", "editor", "publisher", "admin"];

function asPlan(value: string | null | undefined): PlanTier {
  if (value && PLAN_TIERS.includes(value as PlanTier)) return value as PlanTier;
  return "starter";
}

function asSocialLevel(value: string | null | undefined): SocialPermissionLevel {
  if (value && SOCIAL_LEVELS.includes(value as SocialPermissionLevel)) {
    return value as SocialPermissionLevel;
  }
  return "admin";
}

export function mapApiUserToUser(
  apiUser: ApiUserRaw,
  workspace?: ApiWorkspaceSummary | null,
): User {
  return {
    id: String(apiUser.id),
    email: apiUser.email,
    name: apiUser.full_name?.trim() || apiUser.email.split("@")[0] || "User",
    isPlatformAdmin: Boolean(apiUser.is_platform_admin),
    workspaceId: workspace ? String(workspace.id) : "",
    workspaceName: workspace?.name ?? "",
    workspaceLogoUrl: null,
    socialPermissionLevel: asSocialLevel(workspace?.social_level),
    plan: asPlan(workspace?.plan),
  };
}

export function mapMeResponseToUser(me: MeResponse): User {
  const workspace = me.workspaces[0] ?? null;
  return mapApiUserToUser(me.user, workspace);
}

export function mapRegisterResponseToUser(data: RegisterResponse): User {
  return mapApiUserToUser(data.user, data.workspace);
}
