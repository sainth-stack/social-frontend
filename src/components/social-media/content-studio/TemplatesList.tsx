"use client";

import { useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import {
  Alert,
  Box,
  Chip,
  Grid,
  InputAdornment,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import AppTextarea from "@/components/ui/AppTextarea";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import TemplateUseModal, { GOAL_LABELS } from "@/components/social-media/content-studio/TemplateUseModal";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { selectUser } from "@/features/auth/authSlice";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
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

const GOAL_CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  lead_gen: { bg: "#EDE9FE", color: "#6D28D9" },
  trust: { bg: "#D1FAE5", color: "#065F46" },
  conversion: { bg: "#FEF3C7", color: "#92400E" },
  awareness: { bg: "#DBEAFE", color: "#1E40AF" },
  general: { bg: "#F1F5F9", color: "#475569" },
};

// ─── Template card ─────────────────────────────────────────────────────────

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
  const goalStyle = template.goal ? (GOAL_CHIP_COLORS[template.goal] ?? GOAL_CHIP_COLORS.general) : null;

  return (
    <Box
      sx={{
        ...surfaceSx,
        p: 2.5,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        transition: "box-shadow 0.15s",
        "&:hover": {
          boxShadow: "0 4px 16px rgba(15,23,42,0.09)",
        },
      }}
    >
      {/* Header row */}
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        <Typography
          sx={{ fontWeight: 600, fontSize: "0.9375rem", flex: 1, lineHeight: 1.35, color: colors.textPrimary }}
        >
          {template.name}
        </Typography>
        {template.isSystem && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.3,
              bgcolor: colors.primaryLight,
              color: colors.primary,
              borderRadius: "6px",
              px: 0.75,
              py: 0.25,
              flexShrink: 0,
            }}
          >
            <StarBorderOutlinedIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, lineHeight: 1 }}>PRO</Typography>
          </Box>
        )}
      </Stack>

      {/* Description */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          fontSize: "0.8125rem",
          lineHeight: 1.55,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          flex: 1,
        }}
      >
        {template.description || "Customise this template for your brand."}
      </Typography>

      {/* Meta badges */}
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Chip
          label={template.category}
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.6875rem", height: 22 }}
        />
        {goalStyle && template.goal && (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              bgcolor: goalStyle.bg,
              color: goalStyle.color,
              borderRadius: "6px",
              px: 0.75,
              py: 0.25,
              fontSize: "0.6875rem",
              fontWeight: 600,
            }}
          >
            {GOAL_LABELS[template.goal] ?? template.goal}
          </Box>
        )}
        {template.generateImage && (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              bgcolor: "#F0FDF4",
              color: "#16A34A",
              borderRadius: "6px",
              px: 0.75,
              py: 0.25,
              fontSize: "0.6875rem",
              fontWeight: 600,
            }}
          >
            <ImageOutlinedIcon sx={{ fontSize: 11 }} />
            AI Image
          </Box>
        )}
      </Stack>

      {/* Platforms */}
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
        {template.platforms.slice(0, 4).map((p) => (
          <Chip
            key={p}
            label={PLATFORM_LABELS[p] ?? p}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.6875rem", height: 22, color: colors.textSecondary, borderColor: colors.border }}
          />
        ))}
      </Stack>

      {/* Actions */}
      <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
        <AppButton
          variant="primary"
          size="small"
          leftIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
          onClick={onUse}
          sx={{ flex: 1, fontWeight: 600 }}
        >
          Use Template
        </AppButton>
        {!template.isSystem && (
          <>
            <AppButton variant="secondary" size="small" onClick={onEdit}>
              Edit
            </AppButton>
            <AppButton variant="ghost" size="small" onClick={onDelete}>
              Delete
            </AppButton>
          </>
        )}
      </Stack>
    </Box>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function TemplateCardSkeleton() {
  return (
    <Box sx={{ ...surfaceSx, p: 2.5 }}>
      <Skeleton variant="text" width="65%" height={22} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="95%" />
      <Skeleton variant="text" width="80%" sx={{ mb: 1.5 }} />
      <Skeleton variant="rectangular" height={24} sx={{ borderRadius: 1, mb: 1.5 }} />
      <Skeleton variant="rectangular" height={34} sx={{ borderRadius: 1 }} />
    </Box>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function TemplatesList() {
  const dispatch = useAppDispatch();
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
      result = result.filter((t) => t.category.toLowerCase() === activeCategory.toLowerCase());
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
    setForm({ name: "", category: "general", captionTemplate: "", hashtags: "", platforms: "linkedin,facebook,instagram,x" });
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
      hashtags: form.hashtags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
      platforms: form.platforms.split(",").map((s) => s.trim()).filter(Boolean) as SocialPlatform[],
    };
    try {
      if (editing) {
        await socialMediaApi.updateTemplate(orgId, editing.id, payload);
      } else {
        await socialMediaApi.createTemplate(orgId, payload);
      }
      setCreateOpen(false);
      dispatch(enqueueToast({ message: "Template saved", severity: "success" }));
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const message =
        typeof detail === "object" && detail && "message" in detail
          ? String((detail as { message: string }).message)
          : typeof detail === "string"
            ? detail
            : "Failed to save template";
      dispatch(enqueueToast({ message, severity: "error" }));
    }
  };

  return (
    <Box>
      <PageHeader
        title="Templates"
        subtitle="Pick a template, fill in your details, then generate your post in AI Studio"
        primaryAction={
          <AppButton variant="primary" leftIcon={<AddIcon sx={{ fontSize: 18 }} />} onClick={openCreate}>
            Create Template
          </AppButton>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Search + category filter */}
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", mb: 3, alignItems: "center" }}>
        <AppInput
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ color: colors.textSecondary, fontSize: 18 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 260 }}
        />
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              clickable
              color={activeCategory === c.value ? "primary" : "default"}
              variant={activeCategory === c.value ? "filled" : "outlined"}
              size="small"
              onClick={() => setActiveCategory(c.value)}
            />
          ))}
        </Stack>
      </Stack>

      {/* Templates grid */}
      {loading ? (
        <Box>
          <Skeleton variant="text" width={180} height={26} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                <TemplateCardSkeleton />
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (
        <Stack spacing={4}>
          {filteredSystem.length > 0 && (
            <Box>
              <Stack direction="row" spacing={0.75} sx={{ mb: 2, alignItems: "center" }}>
                <StarBorderOutlinedIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
                <Typography sx={{ fontWeight: 600, fontSize: "0.9375rem", color: colors.textPrimary }}>
                  Ready-to-use templates
                </Typography>
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  {filteredSystem.length}
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                {filteredSystem.map((t) => (
                  <Grid key={t.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <TemplateCard
                      template={t}
                      onUse={() => setUseTemplate(t)}
                      onEdit={() => openEdit(t)}
                      onDelete={() => setDeleteId(t.id)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {filteredCustom.length > 0 && (
            <Box>
              <Stack direction="row" spacing={0.75} sx={{ mb: 2, alignItems: "center" }}>
                <Typography sx={{ fontWeight: 600, fontSize: "0.9375rem", color: colors.textPrimary }}>
                  My templates
                </Typography>
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  {filteredCustom.length}
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                {filteredCustom.map((t) => (
                  <Grid key={t.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <TemplateCard
                      template={t}
                      onUse={() => setUseTemplate(t)}
                      onEdit={() => openEdit(t)}
                      onDelete={() => setDeleteId(t.id)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {filteredSystem.length === 0 && filteredCustom.length === 0 && (
            <Box sx={{ ...surfaceSx, p: 8, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 600, mb: 0.75 }}>No templates found</Typography>
              <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 300, mx: "auto" }}>
                {search || activeCategory !== "all"
                  ? "Try a different search or category."
                  : "Create your first template to speed up content creation."}
              </Typography>
              <AppButton variant="primary" onClick={openCreate}>
                Create Template
              </AppButton>
            </Box>
          )}
        </Stack>
      )}

      {/* Use template modal */}
      <TemplateUseModal
        open={Boolean(useTemplate)}
        template={useTemplate}
        orgId={orgId}
        onClose={() => setUseTemplate(null)}
      />

      {/* Create / edit modal */}
      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editing ? "Edit template" : "Create template"}
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</AppButton>
            <AppButton variant="primary" onClick={() => void save()}>
              {editing ? "Save changes" : "Create"}
            </AppButton>
          </>
        }
      >
        <Stack spacing={2}>
          <AppInput
            label="Template name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <AppInput
            label="Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <AppInput
            label="Platforms"
            value={form.platforms}
            onChange={(e) => setForm((f) => ({ ...f, platforms: e.target.value }))}
            helperText="Comma-separated: linkedin, facebook, instagram, x"
          />
          <AppTextarea
            label="Caption template"
            minRows={5}
            value={form.captionTemplate}
            onChange={(e) => setForm((f) => ({ ...f, captionTemplate: e.target.value }))}
            helperText="Use {{placeholder}} tokens, e.g. {{company_name}}, {{offer}}"
          />
          <AppInput
            label="Default hashtags"
            value={form.hashtags}
            onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
            placeholder="Growth, Marketing, SaaS"
          />
        </Stack>
      </AppModal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete template?"
        description="This template will be permanently removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void socialMediaApi
            .deleteTemplate(orgId, deleteId)
            .then(() => {
              setDeleteId(null);
              dispatch(enqueueToast({ message: "Template deleted", severity: "success" }));
              return load();
            })
            .catch(() => dispatch(enqueueToast({ message: "Failed to delete", severity: "error" })));
        }}
      />
    </Box>
  );
}
