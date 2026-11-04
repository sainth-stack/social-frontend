"use client";

import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RunItem } from "@/types/planner";
import type { PlannerDateGroup, PlannerDatePhase } from "./planner-groups";
import { groupIsWritingCopy, groupPhase, itemIsWritingCopy, itemNeedsImage } from "./planner-groups";
import PlannerItemEditor from "./PlannerItemEditor";
import PlannerItemGeneratingPanel from "./PlannerItemGeneratingPanel";
import type { CopyEdit, SlotEdit } from "@/types/planner";

const phaseSteps: { id: PlannerDatePhase; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "image", label: "Image" },
  { id: "done", label: "Done" },
];

export default function PlannerDateReview({
  group,
  groupIndex,
  groupCount,
  activeItem,
  activeItemIndex,
  accountName,
  workspaceId,
  canEdit,
  busy,
  error,
  dirty,
  imageDirection,
  onImageDirectionChange,
  onActiveItem,
  onSave,
  onSlot,
  onApproveItem,
  onApproveAll,
  onRegenerateText,
  onGenerateAllImages,
  groupGeneratingImages,
  groupPendingImageCount,
  onGenerate,
  onRetryImage,
  onTextOnly,
  onAttach,
  onNavigationGuard,
  onDirtyChange,
}: {
  group: PlannerDateGroup;
  groupIndex: number;
  groupCount: number;
  activeItem: RunItem;
  activeItemIndex: number;
  accountName: string;
  workspaceId: string;
  canEdit: boolean;
  busy: boolean;
  error: string;
  dirty: boolean;
  imageDirection: string;
  onImageDirectionChange: (value: string) => void;
  onActiveItem: (itemId: string) => void;
  onSave: (payload: CopyEdit) => Promise<boolean>;
  onSlot: (payload: SlotEdit) => Promise<boolean>;
  onApproveItem: () => void;
  onApproveAll: () => void;
  onRegenerateText?: () => void;
  onGenerateAllImages?: () => void;
  groupGeneratingImages?: boolean;
  groupPendingImageCount?: number;
  onGenerate?: () => void;
  onRetryImage?: () => void;
  onTextOnly?: () => void;
  onAttach?: (assetId: string) => Promise<boolean>;
  onNavigationGuard?: (guard: ((action: () => void) => void) | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const phase = groupPhase(group);
  const multiPlatform = group.items.length > 1;
  const wizardTab = phase === "text" ? "copy" : phase === "image" ? "visuals" : "preview";
  const allTextApproved = group.items.every((item) => item.copyApproved && !!item.post);
  const pendingImages = group.items.filter((item) => itemNeedsImage(item));
  const writingActive = itemIsWritingCopy(activeItem);
  const imageBusy = activeItem.visualState === "processing";
  const showEditor = !!activeItem.post && !writingActive && !imageBusy;
  const showGenerating = !showEditor;

  return (
    <section aria-label="Review post for this date" className="space-y-4 rounded-xl border bg-background p-4 md:p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Post {groupIndex + 1} of {groupCount}
            </p>
            <h2 className="font-display text-xl font-semibold">
              {group.date}
              {group.time ? ` · ${group.time}` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {multiPlatform ? `${group.items.length} channels for this date` : `${activeItem.slot.platform} · ${accountName}`}
            </p>
          </div>
        </div>
        <ol className="flex flex-wrap gap-2" aria-label="Steps for this post">
          {phaseSteps.map((step, index) => {
            const active = step.id === phase;
            const complete =
              (step.id === "text" && allTextApproved && !groupIsWritingCopy(group)) ||
              (step.id === "image" && pendingImages.length === 0 && allTextApproved) ||
              (step.id === "done" && phase === "done");
            return (
              <li key={step.id}>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                    active ? "bg-primary text-primary-foreground" : complete ? "bg-muted text-foreground" : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  <span className="tabular-nums">{index + 1}</span>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </header>

      {multiPlatform && (
        <div role="tablist" aria-label="Platforms for this date" className="flex flex-wrap gap-2">
          {group.items.map((item) => {
            const selected = item.id === activeItem.id;
            const needsText = !item.copyApproved && !!item.post;
            const needsImage = itemNeedsImage(item);
            const writing = itemIsWritingCopy(item);
            const processing = item.visualState === "processing";
            const ready = item.canSchedule;
            let badge: { label: string; className: string } | null = null;
            if (writing) badge = { label: "Writing", className: "bg-primary/15 text-primary" };
            else if (processing) badge = { label: "In progress", className: "bg-primary/15 text-primary" };
            else if (needsText) badge = { label: "Review text", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100" };
            else if (needsImage) badge = { label: "Needs image", className: "bg-muted text-muted-foreground" };
            else if (ready) badge = { label: "Ready", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" };
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm capitalize transition-colors",
                  selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
                onClick={() => onActiveItem(item.id)}
              >
                <PlatformIcon platform={item.slot.platform} size="sm" />
                {item.slot.platform}
                {badge && <span className={cn("rounded px-1.5 text-[10px] font-medium", badge.className)}>{badge.label}</span>}
              </button>
            );
          })}
        </div>
      )}

      {phase === "image" && canEdit && !groupGeneratingImages && (groupPendingImageCount ?? 0) > 0 && onGenerateAllImages && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <p className="text-sm text-muted-foreground">One hero image for this date, sized for each channel.</p>
          <Button className="min-h-11" disabled={busy || dirty} onClick={onGenerateAllImages}>
            Generate image
          </Button>
        </div>
      )}

      {phase === "text" && canEdit && showEditor && (
        <div className="flex flex-wrap gap-2">
          {!activeItem.copyApproved && (
            <Button className="min-h-11" disabled={busy || dirty} onClick={onApproveItem}>
              Approve text for {activeItem.slot.platform}
            </Button>
          )}
          {multiPlatform && group.items.some((item) => !item.copyApproved && !!item.post) && (
            <Button variant="secondary" className="min-h-11" disabled={busy || dirty} onClick={onApproveAll}>
              Approve text for all channels
            </Button>
          )}
          {onRegenerateText && showEditor && (
            <Button variant="outline" className="min-h-11" disabled={busy || dirty || activeItem.textState === "uncertain" || activeItem.textState === "processing"} onClick={onRegenerateText}>
              Regenerate text
            </Button>
          )}
        </div>
      )}

      {showGenerating && (
        <PlannerItemGeneratingPanel
          item={activeItem}
          accountName={accountName}
          compact={groupGeneratingImages && imageBusy}
        />
      )}

      {showEditor && (
      <PlannerItemEditor
        key={activeItem.id}
        presentation="inline"
        wizardMode
        wizardPhase={phase === "done" ? "preview" : phase === "image" ? "visuals" : "copy"}
        item={activeItem}
        canEdit={canEdit}
        busy={busy}
        error={error}
        index={activeItemIndex}
        total={group.items.length}
        accountName={accountName}
        workspaceId={workspaceId}
        imageDirection={imageDirection}
        onImageDirectionChange={onImageDirectionChange}
        onClose={() => undefined}
        onMove={() => undefined}
        onSave={onSave}
        onSlot={onSlot}
        onApprove={onApproveItem}
        onGenerate={onGenerate}
        onRetryImage={onRetryImage}
        onTextOnly={onTextOnly}
        onAttach={onAttach}
        onNavigationGuard={onNavigationGuard}
        onDirtyChange={onDirtyChange}
        initialTab={wizardTab}
      />
      )}

    </section>
  );
}
