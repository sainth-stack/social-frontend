import PlannerWorkspace from "@/components/social-media/planner/PlannerWorkspace";

export default async function Page({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <PlannerWorkspace runId={runId} />;
}