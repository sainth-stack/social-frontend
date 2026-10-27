"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PlannerWarnings } from "@/types/planner";
import { displayTime } from "./planner-review";

export default function PlannerConflictDialog({ rows, onChangeTime, onContinue }: { rows: PlannerWarnings[] | null; onChangeTime: () => void; onContinue: () => void }) {
  return <Dialog open={rows !== null} onOpenChange={open => { if (!open) onChangeTime(); }}><DialogContent><DialogHeader><DialogTitle>Other posts at this time</DialogTitle><DialogDescription>These accounts already have posts scheduled at the same time. Change your time or deliberately keep both posts. Nothing will be replaced.</DialogDescription></DialogHeader><ul className="max-h-80 space-y-3 overflow-y-auto">{rows?.flatMap(row => row.warnings ?? []).map(warning => <li key={`${warning.postId}/${warning.fingerprint}`} className="rounded-lg border p-3 text-sm"><p className="font-medium">{warning.accountName}</p><p className="mt-1 text-muted-foreground">{displayTime(warning.scheduledAt, warning.timezone)} · {warning.timezone}</p><p className="mt-2 break-words">{warning.excerpt || "Scheduled post"}</p></li>)}</ul><DialogFooter><Button variant="outline" className="min-h-11" onClick={onChangeTime}>Change time</Button><Button className="min-h-11" onClick={onContinue}>Continue anyway</Button></DialogFooter></DialogContent></Dialog>;
}