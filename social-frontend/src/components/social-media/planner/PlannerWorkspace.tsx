"use client";

import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";
import { hasSocialPermission } from "@/lib/permissions";
import PlannerSetup from "./PlannerSetup";
import PlannerRunReview from "./PlannerRunReview";

export default function PlannerWorkspace({ runId }: { runId?: string }) {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.workspaceId) return <p role="status" className="p-6 text-muted-foreground">Choose a workspace to open the planner.</p>;
  const props = { workspaceId: user.workspaceId, canEdit: hasSocialPermission(user, "editor") };
  const key = JSON.stringify([user.id, user.workspaceId, token, runId]);
  return runId ? <PlannerRunReview key={key} {...props} runId={runId} canPublish={hasSocialPermission(user, "publisher")} /> : <PlannerSetup key={key} {...props} plan={user.plan} />;
}