import type { User } from "@/types/auth";

export function getHomeRoute(user: Pick<User, "isPlatformAdmin">): string {
  return user.isPlatformAdmin ? "/admin" : "/dashboard";
}
