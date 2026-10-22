"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, RefreshCcw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BrandLogo } from "@/types/social-media.types";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return fallback;
}

export function useBrandLogos(orgId: string, version = 0) {
  const [logos, setLogos] = useState<BrandLogo[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      setLogos(await socialMediaApi.listBrandLogos(orgId));
    } catch {
      setLogos([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void reload();
  }, [reload, version]);

  return { logos, setLogos, loading, reload };
}

export function BrandLogoLibrary({
  orgId,
  logos,
  loading,
  onLogosChange,
  selectedId,
  onSelect,
}: {
  orgId: string;
  logos: BrandLogo[];
  loading: boolean;
  onLogosChange: (logos: BrandLogo[]) => void;
  selectedId?: string | null;
  onSelect?: (logo: BrandLogo) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const upload = async (file: File | null) => {
    if (!file || !orgId) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("Use a PNG, JPG or WebP logo");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logo must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const res = await socialMediaApi.uploadLogo(orgId, file, logos.length === 0);
      const next = await socialMediaApi.listBrandLogos(orgId);
      onLogosChange(next);
      const added = next.find((l) => l.id === res.id);
      if (added && onSelect) onSelect(added);
      toast.success("Logo added");
    } catch (err) {
      toast.error(errorMessage(err, "Logo upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const makeDefault = async (logo: BrandLogo) => {
    setBusyId(logo.id);
    try {
      onLogosChange(await socialMediaApi.setDefaultBrandLogo(orgId, logo.id));
      toast.success("Default logo updated");
    } catch (err) {
      toast.error(errorMessage(err, "Could not update default logo"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (logo: BrandLogo) => {
    setBusyId(logo.id);
    try {
      onLogosChange(await socialMediaApi.deleteBrandLogo(orgId, logo.id));
      toast.success("Logo removed");
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove logo"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {loading && logos.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
            ))
          : logos.map((logo) => {
              const selected = selectedId ? selectedId === logo.id : Boolean(onSelect) && logo.isDefault;
              return (
                <div
                  key={logo.id}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-lg border bg-muted/40 transition",
                    selected ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect?.(logo)}
                    disabled={!onSelect}
                    aria-label={`Use ${logo.name}`}
                    className="flex h-full w-full items-center justify-center p-3 disabled:cursor-default"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
                  </button>
                  {selected ? (
                    <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                  {logo.isDefault ? (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold">
                      Default
                    </span>
                  ) : null}
                  <div className="absolute right-1 top-1 flex gap-1 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                    {!logo.isDefault ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-6 w-6"
                        disabled={busyId === logo.id}
                        onClick={() => void makeDefault(logo)}
                        aria-label="Set as default logo"
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6 hover:text-destructive"
                      disabled={busyId === logo.id}
                      onClick={() => void remove(logo)}
                      aria-label="Remove logo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !orgId}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-60"
        >
          {uploading ? <RefreshCcw className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-[11px] font-medium">{uploading ? "Uploading…" : "Upload"}</span>
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        PNG with a transparent background works best · PNG, JPG or WebP up to 5 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function BrandLogoPickerDialog({
  open,
  onOpenChange,
  orgId,
  logos,
  loading,
  onLogosChange,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  logos: BrandLogo[];
  loading: boolean;
  onLogosChange: (logos: BrandLogo[]) => void;
  selectedId: string | null;
  onSelect: (logo: BrandLogo) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a logo</DialogTitle>
          <DialogDescription>
            Pick one of your saved logos or upload a new one from your computer.
          </DialogDescription>
        </DialogHeader>
        <BrandLogoLibrary
          orgId={orgId}
          logos={logos}
          loading={loading}
          onLogosChange={onLogosChange}
          selectedId={selectedId}
          onSelect={(logo) => {
            onSelect(logo);
            onOpenChange(false);
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
