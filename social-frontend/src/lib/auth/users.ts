import type { User } from "@/types/auth";

export function getHomeRoute(user: Pick<User, "isPlatformAdmin">): string {
  return user.isPlatformAdmin ? "/admin" : "/dashboard";
}

/** After login, platform admins land on `/admin` unless returning to an admin URL. */
export function resolvePostLoginPath(
  user: Pick<User, "isPlatformAdmin">,
  redirect: string | null,
): string {
  const home = getHomeRoute(user);
  const target = redirect?.trim() || "";
  if (!target) return home;
  if (user.isPlatformAdmin) {
    return target.startsWith("/admin") ? target : home;
  }
  return target;
}
