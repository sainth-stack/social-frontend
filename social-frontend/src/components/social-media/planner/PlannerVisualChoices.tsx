import { Button } from "@/components/ui/button";
import type { RunItem } from "@/types/planner";

export default function PlannerVisualChoices({ item, disabled, onMedia, onGenerate, onRetry, onTextOnly }: {
  item: RunItem; disabled: boolean; onMedia?: () => void; onGenerate?: () => void; onRetry?: () => void; onTextOnly?: () => void;
}) {
  const unresolvedImage = !!item.imageOperationId && !item.imageRetryable && !["ready", "stale"].includes(item.visualState);
  return <section aria-label="Visual choices" className="space-y-4 rounded-lg border p-4">
    <div><h2 className="text-base font-semibold">Choose visuals</h2><p className="mt-1 text-sm text-muted-foreground">Use your own image, choose stock, generate artwork, or continue without an image where supported.</p></div>
    {!item.copyApproved && <p className="text-sm text-muted-foreground">Save and approve the text before choosing visuals.</p>}
    <div className="space-y-3">
      {onMedia && <div><Button variant="outline" className="min-h-11 w-full" disabled={disabled} onClick={onMedia}>Upload, paste or choose media</Button><p className="mt-1 text-sm text-muted-foreground">Upload or paste an image, reuse your library, or choose stock. No image generation credits. Images only.</p></div>}
      {onGenerate && <div><Button variant="outline" className="min-h-11 w-full" disabled={disabled || unresolvedImage} onClick={onGenerate}>{item.imageOperationId || item.post?.imageUrl ? "Generate new artwork" : "Generate image"}</Button><p className="mt-1 text-sm text-muted-foreground">{unresolvedImage ? "Refresh the saved run to reconcile the existing image operation before requesting new artwork." : "Separate image allowance. Review and confirm before generation."}</p></div>}
      {onRetry && <Button variant="outline" className="min-h-11 w-full" disabled={disabled} onClick={onRetry}>Retry saved image operation</Button>}
      {item.slot.platform !== "instagram" && onTextOnly && <div><Button variant="outline" className="min-h-11 w-full" disabled={disabled || item.imageIntent === "text_only"} onClick={onTextOnly}>Use text only</Button><p className="mt-1 text-sm text-muted-foreground">Facebook and LinkedIn support posts without an image. Confirmation removes the current attachment.</p></div>}
      {item.slot.platform === "instagram" && <p className="text-sm text-muted-foreground">Instagram requires a current image.</p>}
    </div>
  </section>;
}