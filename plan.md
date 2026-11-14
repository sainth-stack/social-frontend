# EarnedVoice image generation — simplified unified plan (v5)

**Supersedes** the v4 five-phase `legacy | accuracy` rollout. One pipeline for all **create** flows; image generation must work end-to-end from every entry point.

---

## Principles

1. **One flow** — no `IMAGE_PIPELINE_VERSION`, no shadow mode, no “simple” create path beside the structured pipeline.
2. **Repo APIs unchanged** — same endpoints and schemas; clients keep working.
3. **Brief-first** — user prompt / slide direction defines subject and action; caption is context unless there is no brief.
4. **Keep what already works** — visual skills, art direction JSON, `compile_image_prompt`, `build_negative_prompt`, Bedrock Stability, candidates + judge, product inpaint, compositor, quality gates.
5. **Add complexity only when measured** — human label gates and mandatory auto-reject are optional later, not blockers.
6. **Tests mock AWS** — no live Bedrock in unit tests.

---

## Single production flow (create)

```text
Client → CreativeSpec → skill → art_direct (brief-first)
    → compile_image_prompt + build_negative_prompt
    → For each candidate (× IMAGE_CANDIDATES):
          product_scene inpaint  OR  generate_post_image (prompt_override + negative)
          → validate_image_bytes (stage=base) — invalid candidates discarded
    → If zero survivors → error (no compose on bad bases)
    → _select_base_image → pick_best_image (vision/heuristic) when count > 1
    → validate base again
    → compose_creative (per platform)
    → validate_image_bytes (stage=export) — compositor also validates at export
    → upload + usage + response
```

**Product path:** `product_cutout` runs once before candidates; `PRODUCT_NOT_FOUND` if cutout fails — never approximate the product with T2I alone.

**Model policy:** Keep **Stable Image Ultra** until brief-first + negative prompts are measured; do not switch models in v5 implementation.

**Edit mode** (`generate-image` with `mode=edit` + source URL): thin img2img via `generate_post_image` / `generate_image_variation` — not the full compose pipeline unless product requirements change later.

### Entry points (all use the same core)

| Entry | API / job | Renderer | Status |
|-------|-----------|----------|--------|
| AI Studio artwork | `POST …/generate-creative-set` | `render_brand_creative_variants` → `render_creative_variants` | ✅ |
| Direct create | `POST …/generate-image` `mode=create` | `render_brand_creative` → `render_creative` | ✅ |
| Direct edit | `POST …/generate-image` `mode=edit` | `generate_post_image_from_url` (img2img only) | ✅ separate by design |
| Explore ideas | `POST …/image-concepts` | `explore_concepts` (text; brief-first) | ✅ |
| Weekly planner | Celery `generate_planner_image` | `image_locked` → `generate_creative_set` → same variants | ✅ topic = plan brief + direction |
| Content plan hero | `content_plan.py` | `render_brand_creative` | ✅ |
| Campaign draft image | `service.py` (~L732) | `render_brand_creative` with `CreativeSpec` | ✅ |

### `generate_post_image` callers (create must compile first)

| Caller | create + `prompt_override`? | Notes |
|--------|------------------------------|--------|
| `render_creative_variants` | **Yes** | Production path |
| `generate_post_image_from_url` (edit) | N/A (`mode=edit`) | Uses `_build_edit_prompt` |
| Unit tests | Sometimes no override | Tests transport/fallback; logs warning if create without override |

Do not add new create callers without going through `render_creative`.

### Progress stages (unchanged)

`concept` → `generate` → `review` (multi-candidate) → `format` → `save`

No new polling/streaming in this plan unless product explicitly asks.

---

## What we removed from v4

| v4 | v5 |
|----|-----|
| Dual pipeline + legacy default | **One pipeline** |
| Extra LLM “requirements extraction” pass | **Art direction + negative prompt** carry intent |
| Phase 3A gate before ship | **Optional** benchmark kit later |
| Shadow mode + gradual rollout flag | **Not needed** with single flow |
| Separate simple `_build_create_prompt` create path | **Removed** — Bedrock only via compiled prompt inside `render_creative` |

---

## Five implementation requirements (approved)

1. **Candidate validation order** — each `make()` validates at `stage=base`; failed gens dropped; `_select_base_image` judges only survivors; if all fail, raise before compose. ✅ (`creative.py`)
2. **Same renderer everywhere** — audit table above; planner `topic` = plan brief (+ optional `imageDirection`), not caption alone. ✅
3. **Protect `generate_post_image`** — create uses `prompt_override` from compile; warning log if create without override; edit unchanged. ✅
4. **Product scene** — shared art direction → cutout once → per-candidate inpaint → same judge/compose/validate; cutout errors surface `PRODUCT_NOT_FOUND`. ✅ (existing)
5. **Final validation** — `compose_creative` validates export; `render_creative_variants` validates each platform JPEG again at `stage=export`; creative-set upload re-validates. ✅

---

## Implementation steps (lean)

Do these in order on **one branch** (or small PRs that each keep tests green).

### Step 1 — Unify entry points ✅

- [x] `generate-image` `mode=create` always uses `CreativeSpec` + `render_brand_creative`.
- [x] Removed broken `image_pipeline` / `requirements` branches.
- [x] **Brief-first** `art_direct` default; planner request `topic` aligned.

**Files:** `app/social/service.py`, `app/social/ai/creative.py`, `app/social/content_plan_runs.py`

### Step 2 — Prompt accuracy ✅

- [x] `build_negative_prompt` on structured compile path.
- [x] `explore_concepts` brief-first (system + user message order).
- [x] `generate_post_image` transport warning when create lacks `prompt_override`.

**Files:** `creative.py`, `image_generator.py`

### Step 3 — Reliability ✅ (verify in CI)

- [x] Art-direction fallback after 2 LLM failures.
- [x] Per-candidate + base + export validation.
- [x] Product cutout failure → provider error, no silent substitute product.

**Files:** `creative.py`, `product_scene.py`, `image_quality.py`

### Step 4 — Composition & platforms

- [ ] Platform sizes: `creative._SIZES` / `_DEFAULT_SIZES` (repo wins over marketing copy).
- [ ] Compositor: keep center-weighted fit; **optional later:** subject-aware crop when product bbox exists.

**Files:** `compositor.py` (only when improving crop)

### Step 5 — Optional benchmarks (not required to ship)

- [ ] `tests/fixtures/image_accuracy/` — JSON briefs for regression tests (mocked generation).
- [ ] CLI script with `BENCHMARK_MAX_SPEND_USD` for manual review — only when you set a cap.
- [ ] Delete or revive `accuracy_judge.py` **only** if human labels justify it.

**Deliverable:** `docs/image-accuracy/benchmark-notes.md` (optional)

### Step 6 — Docs

- [ ] Update `frontend/image.md` § flow to match this document (one diagram).
- [ ] Operator checklist: Bedrock model, regions, `IMAGE_CANDIDATES`, plan limits.

---

## Configuration

| Variable | Purpose |
|----------|---------|
| `BEDROCK_IMAGE_MODEL_ID` | Default `stability.stable-image-ultra-v1:1` |
| `IMAGE_CANDIDATES` | 1–4 parallel T2I calls before judge |
| `BEDROCK_IMAGE_SERVICES_REGION` | Product remove-bg / inpaint (`us-west-2`) |
| `BEDROCK_VISION_MODEL_ID` | Optional; judge fallback |
| Plan limits | `enforce_ai_image_limit` — unchanged |

**Not used in v5:** `IMAGE_PIPELINE_VERSION`, shadow sampling, benchmark cap in production.

**Optional:** `BENCHMARK_MAX_SPEND_USD` only for Step 5 manual runs.

---

## Platform dimensions (source of truth)

From `app/social/ai/creative.py`:

- Instagram post: 1080×1350  
- LinkedIn post: 1200×1200  
- LinkedIn banner: 1200×**627**  
- Facebook banner: 1200×630  
- X post: 1600×900  
- Story default: 1080×1920  
- See `_SIZES` for full matrix.

Generation uses nearest Stability **aspect ratio**, then compositor fits to exact pixels.

---

## Success criteria

1. AI Studio, planner, and `generate-image` (create) all call `render_creative` / variants — **one code path**.
2. No import/runtime errors from removed pipeline flags.
3. `pytest` image tests pass with mocks.
4. Edit mode still refines an existing image.
5. **Primary product test:** user brief names subject + action + environment → image reflects the **brief**, not a generic caption-shaped scene (measure qualitatively in Studio before changing models).

---

## Testing checklist (before merge)

```bash
cd frontend/social-backend
pytest tests/test_image_pipeline.py tests/test_creative.py tests/test_image_reliability.py tests/test_planner_images.py -q
```

Manual (staging): AI Studio generate artwork; planner image on approved draft; `generate-image` with topic only.

---

## Handoff files

| File | Purpose |
|------|---------|
| `docs/image-accuracy/plan.md` | **This plan** — engineering source of truth |
| `docs/image-accuracy/plan-unified.md` | Short summary (can merge into plan.md over time) |
| `frontend/image.md` | Operator / support documentation |

---

## Human inputs (optional benchmarking only)

| Item | When |
|------|------|
| `BENCHMARK_MAX_SPEND_USD` | Before any paid batch in Step 5 |
| Reviewer + deadline | If you run human labelling |

---

**Core principle:** Generate what the user requested in the brief, not a generic stock interpretation. One pipeline, brief-first art direction, context-aware negatives, then compose for the platform.