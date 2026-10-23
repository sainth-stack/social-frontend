"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectBrandVoice } from "@/features/social-media/socialSettingsSlice";
import { fetchBrandVoice } from "@/features/social-media/socialSettingsThunks";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialTemplate } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

export const GOAL_LABELS: Record<string, string> = {
  lead_gen: "Lead Generation",
  trust: "Trust & Proof",
  conversion: "Conversion",
  awareness: "Awareness",
  general: "General",
};

type TemplateUseModalProps = {
  open: boolean;
  template: SocialTemplate | null;
  orgId: string;
  onClose: () => void;
};

export function templateApplyStorageKey(orgId: string, templateId: string) {
  return `socialTemplateApply:${orgId}:${templateId}`;
}

export default function TemplateUseModal({
  open,
  template,
  orgId,
  onClose,
}: TemplateUseModalProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const brandVoice = useAppSelector(selectBrandVoice);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    void dispatch(fetchBrandVoice(orgId));
  }, [dispatch, orgId]);

  const placeholders = useMemo(() => template?.placeholders ?? [], [template]);

  useEffect(() => {
    if (!template || !open) return;
    const initial: Record<string, string> = {};
    for (const ph of placeholders) {
      if (ph.key === "company_name" && brandVoice?.brandName) {
        initial[ph.key] = brandVoice.brandName;
      } else if (ph.example) {
        initial[ph.key] = ph.example;
      } else {
        initial[ph.key] = "";
      }
    }
    setValues(initial);
    setError(null);
  }, [template, open, placeholders, brandVoice?.brandName]);

  const handleGenerate = async () => {
    if (!template || !orgId) return;

    const missing = placeholders.filter(
      (ph) => ph.required && !String(values[ph.key] ?? "").trim(),
    );
    if (missing.length) {
      setError(`Please fill: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await socialMediaApi.applyTemplate(orgId, template.id, values);
      sessionStorage.setItem(
        templateApplyStorageKey(orgId, template.id),
        JSON.stringify(result),
      );
      onClose();
      toast.success("Template applied — opening AI Studio");
      router.push(`/dashboard/content-studio/generate?templateId=${template.id}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      setError(typeof detail === "string" ? detail : "Failed to apply template");
    } finally {
      setSubmitting(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Use: {template.name}</DialogTitle>
          <DialogDescription>
            Fill in your details — AI will create platform-native posts
            {template.generateImage ? " and generate an image" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge variant="outline">{template.category}</Badge>
              {template.goal ? (
                <Badge variant="secondary">
                  {GOAL_LABELS[template.goal] ?? template.goal}
                </Badge>
              ) : null}
              {template.platforms.map((p) => (
                <Badge key={p} variant="outline">
                  {PLATFORM_LABELS[p] ?? p}
                </Badge>
              ))}
              {template.generateImage ? (
                <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300">
                  <ImageIcon className="h-3 w-3" />
                  AI Image
                </Badge>
              ) : null}
            </div>
            {template.description ? (
              <p className="text-sm text-muted-foreground">{template.description}</p>
            ) : null}
          </div>

          {placeholders.length === 0 ? (
            <div className="space-y-1.5">
              <Label>Post content</Label>
              <Textarea
                rows={6}
                value={values.content ?? template.captionTemplate}
                onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
              />
            </div>
          ) : (
            placeholders.map((ph) => (
              <div key={ph.key} className="space-y-1.5">
                <Label>
                  {ph.label}
                  {ph.required ? " *" : ""}
                </Label>
                <Input
                  value={values[ph.key] ?? ""}
                  placeholder={ph.example}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [ph.key]: e.target.value }))
                  }
                />
              </div>
            ))
          )}

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button disabled={submitting} onClick={() => void handleGenerate()}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
