import type { SocialPermissionLevel, User } from "@/types/auth";

const SOCIAL_RANK: Record<SocialPermissionLevel, number> = {
  viewer: 1,
  editor: 2,
  publisher: 3,
  admin: 4,
};

/** True if `user` has at least `minimum` social permission level (or is a platform admin). */
export function hasSocialPermission(
  user: User | null | undefined,
  minimum: SocialPermissionLevel,
): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  const level = user.socialPermissionLevel ?? "viewer";
  return SOCIAL_RANK[level] >= SOCIAL_RANK[minimum];
}

export function canManageSettings(user: User | null | undefined): boolean {
  return hasSocialPermission(user, "admin");
}

export function socialPermissionLabel(level: SocialPermissionLevel): string {
  switch (level) {
    case "viewer":
      return "Viewer";
    case "editor":
      return "Editor";
    case "publisher":
      return "Publisher";
    case "admin":
      return "Admin";
  }
}
