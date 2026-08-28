"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  CreditCard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  User as UserIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { logout, selectUser } from "@/features/auth/authSlice";
import { canManageSettings, socialPermissionLabel } from "@/lib/permissions";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { PLAN_DISPLAY_NAMES } from "@/lib/plans";

type TopbarProps = {
  onMenuClick?: () => void;
  isAdmin?: boolean;
};

function userInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Topbar({ onMenuClick, isAdmin = false }: TopbarProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);

  const workspaceName = isAdmin ? "Platform Admin" : (user?.workspaceName ?? "Workspace");
  const settingsHref = user && canManageSettings(user) ? "/dashboard/settings" : undefined;
  const roleLabel = user
    ? user.isPlatformAdmin
      ? "Platform Admin"
      : socialPermissionLabel(user.socialPermissionLevel)
    : null;

  const handleLogout = () => {
    dispatch(logout());
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold">{workspaceName}</span>
        {!isAdmin && user ? (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {PLAN_DISPLAY_NAMES[String(user.plan).toLowerCase()] ?? "Free"}
          </Badge>
        ) : null}
      </div>

      <div className="ml-2 hidden max-w-xs flex-1 items-center md:flex">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={isAdmin ? "Search users, invoices…" : "Search posts, media, drafts…"}
            className="h-9 pl-9"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {!isAdmin ? (
          <Button size="sm" className="gap-1.5" asChild>
            <Link href="/dashboard/content-studio/generate">
              <Plus className="h-4 w-4" /> New Post
            </Link>
          </Button>
        ) : null}

        {!isAdmin ? (
          <Link
            href="/dashboard/notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Link>
        ) : null}

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    {userInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                  {roleLabel ? (
                    <span className="mt-1 text-[11px] text-muted-foreground">{roleLabel}</span>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!isAdmin ? (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <UserIcon className="mr-2 h-4 w-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {settingsHref ? (
                <DropdownMenuItem asChild>
                  <Link href={settingsHref}>
                    <Settings className="mr-2 h-4 w-4" /> Workspace settings
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {!isAdmin ? (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/billing">
                    <CreditCard className="mr-2 h-4 w-4" /> Plan
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {user.isPlatformAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={isAdmin ? "/dashboard" : "/admin"}>
                      <Shield className="mr-2 h-4 w-4" />
                      {isAdmin ? "Exit admin" : "Admin console"}
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
