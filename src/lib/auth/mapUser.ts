import type { ApiUser, User } from "@/types/auth";

/** Map backend user payload to the normalized frontend `User` shape. */
export function mapApiUserToUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.name,
    isPlatformAdmin: apiUser.isPlatformAdmin ?? false,
    workspaceId: apiUser.workspaceId,
    workspaceName: apiUser.workspaceName,
    workspaceLogoUrl: apiUser.workspaceLogoUrl ?? null,
    socialPermissionLevel: apiUser.socialPermissionLevel ?? "admin",
    plan: apiUser.plan ?? "starter",
  };
}
