import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RunItem } from "@/types/planner";

export default function PlannerVisualChoices({
  item,
  disabled,
  imageDirection = "",
  onImageDirectionChange,
  onMedia,
  onGenerate,
  onRetry,
  onTextOnly,
}: {
  item: RunItem;
  disabled: boolean;
  imageDirection?: string;
  onImageDirectionChange?: (value: string) => void;
  onMedia?: () => void;
  onGenerate?: () => void;
  onRetry?: () => void;
  onTextOnly?: () => void;
}) {
  const unresolvedImage =
    !!item.imageOperationId && !item.imageRetryable && !["ready", "stale"].includes(item.visualState);
  const hasImage = !!(item.imageOperationId || item.post?.imageUrl);

  return (
    <section aria-label="Visual choices" className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-base font-semibold">Image</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your own, generate a campaign-style image from your approved copy, or post without one where allowed.
        </p>
      </div>
      {!item.copyApproved && (
        <p className="text-sm text-muted-foreground">Approve the text on the Copy tab first.</p>
      )}
      {onImageDirectionChange && (
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Art direction (optional)</span>
          <Textarea
            maxLength={1500}
            rows={2}
            disabled={disabled}
            value={imageDirection}
            onChange={(event) => onImageDirectionChange(event.target.value)}
            placeholder="e.g. founder at desk with microphone, modern office, soft daylight"
          />
          <span className="text-xs text-muted-foreground">
            Leave blank for a strong default hero image tied to your caption and brand.
          </span>
        </label>
      )}
      <div className="flex flex-col gap-2">
        {onMedia && (
          <Button variant="outline" className="min-h-11 w-full justify-start" disabled={disabled} onClick={onMedia}>
            Upload or choose from library
          </Button>
        )}
        {onGenerate && (
          <Button
            variant="default"
            className="min-h-11 w-full justify-start"
            disabled={disabled || unresolvedImage}
            onClick={onGenerate}
          >
            {hasImage ? "Generate new image" : "Generate image"}
          </Button>
        )}
        {unresolvedImage && (
          <p className="text-xs text-muted-foreground">
            Refresh the saved run before starting a new generation.
          </p>
        )}
        {onRetry && (
          <Button variant="outline" className="min-h-11 w-full justify-start" disabled={disabled} onClick={onRetry}>
            Retry last attempt
          </Button>
        )}
        {item.slot.platform !== "instagram" && onTextOnly && (
          <Button
            variant="ghost"
            className="min-h-11 w-full justify-start"
            disabled={disabled || item.imageIntent === "text_only"}
            onClick={onTextOnly}
          >
            Use text only
          </Button>
        )}
        {item.slot.platform === "instagram" && (
          <p className="text-xs text-muted-foreground">Instagram requires an image.</p>
        )}
      </div>
    </section>
  );
}
