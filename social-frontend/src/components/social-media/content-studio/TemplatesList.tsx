"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import TemplateUseModal, {
  GOAL_LABELS,
} from "@/components/social-media/content-studio/TemplateUseModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { selectUser } from "@/features/auth/authSlice";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { SocialPlatform, SocialTemplate } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

const CATEGORIES = [
  { label: "All", value: "all" },
  { label: "Sales", value: "Sales" },
  { label: "Social Proof", value: "Social Proof" },
  { label: "Product", value: "Product" },
  { label: "Engagement", value: "Engagement" },
  { label: "Event", value: "Event" },
  { label: "Holiday", value: "Holiday" },
] as const;

function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
}: {
  template: SocialTemplate;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <CardTitle className="flex-1 text-base leading-snug">{template.name}</CardTitle>
          {template.isSystem ? (
            <Badge variant="secondary" className="shrink-0 gap-1">
              <Star className="h-3 w-3" />
              PRO
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {template.description || "Customise this template for your brand."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{template.category}</Badge>
          {template.goal ? (
            <Badge variant="secondary">{GOAL_LABELS[template.goal] ?? template.goal}</Badge>
          ) : null}
          {template.generateImage ? (
            <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300">
              <ImageIcon className="h-3 w-3" />
              AI Image
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {template.platforms.slice(0, 4).map((p) => (
            <Badge key={p} variant="outline" className="text-muted-foreground">
              {PLATFORM_LABELS[p] ?? p}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button size="sm" className="flex-1" onClick={onUse}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Use Template
        </Button>
        {!template.isSystem ? (
          <>
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : null}
      </CardFooter>
    </Card>
  );
}

export default function TemplatesList() {
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";

  const [items, setItems] = useState<SocialTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [useTemplate, setUseTemplate] = useState<SocialTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SocialTemplate | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "general",
    captionTemplate: "",
    hashtags: "",
    platforms: "linkedin,facebook,instagram,x",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      setItems(await socialMediaApi.listTemplates(orgId));
      setError(null);
    } catch {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const systemTemplates = useMemo(() => items.filter((t) => t.isSystem), [items]);
  const customTemplates = useMemo(() => items.filter((t) => !t.isSystem), [items]);

  const filterItems = (list: SocialTemplate[]) => {
    let result = list;
    if (activeCategory !== "all") {
      result = result.filter(
        (t) => t.category.toLowerCase() === activeCategory.toLowerCase(),
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      );
    }
    return result;
  };

  const filteredSystem = filterItems(systemTemplates);
  const filteredCustom = filterItems(customTemplates);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      category: "general",
      captionTemplate: "",
      hashtags: "",
      platforms: "linkedin,facebook,instagram,x",
    });
    setCreateOpen(true);
  };

  const openEdit = (t: SocialTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      category: t.category,
      captionTemplate: t.captionTemplate,
      hashtags: t.hashtags.join(", "),
      platforms: t.platforms.join(","),
    });
    setCreateOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "general",
      captionTemplate: form.captionTemplate,
      hashtags: form.hashtags
        .split(",")
        .map((s) => s.trim().replace(/^#/, ""))
        .filter(Boolean),
      platforms: form.platforms
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as SocialPlatform[],
    };
    setSaving(true);
    try {
      if (editing) {
        await socialMediaApi.updateTemplate(orgId, editing.id, payload);
      } else {
        await socialMediaApi.createTemplate(orgId, payload);
      }
      setCreateOpen(false);
      toast.success("Template saved");
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      const message =
        typeof detail === "object" && detail && "message" in detail
          ? String((detail as { message: string }).message)
          : typeof detail === "string"
            ? detail
            : "Failed to save template";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Pick a template, fill in your details, then generate your post in AI Studio.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setActiveCategory(c.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeCategory === c.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSystem.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Ready-to-use templates</h2>
                <span className="text-xs text-muted-foreground">{filteredSystem.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSystem.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onUse={() => setUseTemplate(t)}
                    onEdit={() => openEdit(t)}
                    onDelete={() => setDeleteId(t.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {filteredCustom.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">My templates</h2>
                <span className="text-xs text-muted-foreground">{filteredCustom.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCustom.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onUse={() => setUseTemplate(t)}
                    onEdit={() => openEdit(t)}
                    onDelete={() => setDeleteId(t.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {filteredSystem.length === 0 && filteredCustom.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="font-medium">No templates found</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  {search || activeCategory !== "all"
                    ? "Try a different search or category."
                    : "Create your first template to speed up content creation."}
                </p>
                <Button className="mt-4" size="sm" onClick={openCreate}>
                  Create Template
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <TemplateUseModal
        open={Boolean(useTemplate)}
        template={useTemplate}
        orgId={orgId}
        onClose={() => setUseTemplate(null)}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "Create template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Template name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Platforms</Label>
              <Input
                value={form.platforms}
                onChange={(e) => setForm((f) => ({ ...f, platforms: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                Comma-separated: linkedin, facebook, instagram, x
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Caption template</Label>
              <Textarea
                rows={5}
                value={form.captionTemplate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, captionTemplate: e.target.value }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Use {"{{placeholder}}"} tokens, e.g. {"{{company_name}}"}, {"{{offer}}"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Default hashtags</Label>
              <Input
                value={form.hashtags}
                placeholder="Growth, Marketing, SaaS"
                onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This template will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteId) return;
                void socialMediaApi
                  .deleteTemplate(orgId, deleteId)
                  .then(() => {
                    setDeleteId(null);
                    toast.success("Template deleted");
                    return load();
                  })
                  .catch(() => toast.error("Failed to delete"));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
