from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.auth.deps import get_current_user
from app.core.database import get_db
from app.providers.llm.model_selection import ModelSelection, selected_models, validate_model_selection
from app.social.content_plan_runs import ContentPlanRuns
from app.social.planner_schemas import (
    CopyEdit, ImageAction, ImageAsset, ImageIntent, PlannerRun, PlannerSelection, RetryRun, RevisionInput,
    RunCreate, RunItem, RunList, ScheduleConfirm, SchedulePreview, ScheduleResult,
    ScheduleSelection, ScheduleRetry, SlotEdit, SlotPreview, TextRegenerate,
)
from app.social.planner_slots import preview_slots
from app.workspaces.deps import require_workspace_access


router = APIRouter(prefix="/content-plan", tags=["planner-runs"])


@router.post("/slots/preview", response_model=SlotPreview)
def slots_preview(payload: PlannerSelection, workspace: dict = Depends(require_workspace_access),
                  user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    ContentPlanRuns(db).require(workspace, user)
    return preview_slots(db, workspace, payload)


@router.post("/runs", response_model=PlannerRun, status_code=201)
def create_run(payload: RunCreate, workspace: dict = Depends(require_workspace_access),
               user: dict = Depends(get_current_user), db: Database = Depends(get_db),
               models: ModelSelection = Depends(validate_model_selection)):
    with selected_models(models):
        return ContentPlanRuns(db).create(workspace, user, payload)


@router.get("/runs", response_model=RunList)
def list_runs(limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0),
              workspace: dict = Depends(require_workspace_access), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).list(workspace, limit, offset)


@router.get("/runs/{run_id}", response_model=PlannerRun)
def get_run(run_id: str, workspace: dict = Depends(require_workspace_access), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).get(workspace, run_id)


@router.post("/runs/{run_id}/cancel", response_model=PlannerRun)
def cancel_run(run_id: str, workspace: dict = Depends(require_workspace_access),
               user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).cancel(workspace, user, run_id)


@router.post("/runs/{run_id}/retry", response_model=PlannerRun)
def retry_run(run_id: str, payload: RetryRun, workspace: dict = Depends(require_workspace_access),
              user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).retry(workspace, user, run_id, payload.itemIds)


@router.patch("/runs/{run_id}/items/{item_id}/copy", response_model=RunItem)
def edit_copy(run_id: str, item_id: str, payload: CopyEdit, workspace: dict = Depends(require_workspace_access),
              user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).edit_copy(workspace, user, run_id, item_id, payload)


@router.post("/runs/{run_id}/items/{item_id}/approve-copy", response_model=RunItem)
def approve_copy(run_id: str, item_id: str, payload: RevisionInput, workspace: dict = Depends(require_workspace_access),
                 user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).approve_copy(workspace, user, run_id, item_id, payload.expectedRevision)


@router.post("/runs/{run_id}/items/{item_id}/regenerate-text", response_model=RunItem)
def regenerate_text(run_id: str, item_id: str, payload: TextRegenerate, workspace: dict = Depends(require_workspace_access),
                    user: dict = Depends(get_current_user), db: Database = Depends(get_db),
                    models: ModelSelection = Depends(validate_model_selection)):
    with selected_models(models):
        return ContentPlanRuns(db).regenerate_text(workspace, user, run_id, item_id, payload)


@router.post("/runs/{run_id}/items/{item_id}/image", response_model=RunItem)
def generate_image(run_id: str, item_id: str, payload: ImageAction, workspace: dict = Depends(require_workspace_access),
                   user: dict = Depends(get_current_user), db: Database = Depends(get_db),
                   models: ModelSelection = Depends(validate_model_selection)):
    with selected_models(models):
        return ContentPlanRuns(db).image(workspace, user, run_id, item_id, payload)


@router.post("/runs/{run_id}/items/{item_id}/image/start", response_model=RunItem, status_code=202)
def start_image(run_id: str, item_id: str, payload: ImageAction, workspace: dict = Depends(require_workspace_access),
                user: dict = Depends(get_current_user), db: Database = Depends(get_db),
                models: ModelSelection = Depends(validate_model_selection)):
    from app.social.planner_images import start

    with selected_models(models):
        return start(ContentPlanRuns(db), workspace, user, run_id, item_id, payload)


@router.patch("/runs/{run_id}/items/{item_id}/image-intent", response_model=RunItem)
def image_intent(run_id: str, item_id: str, payload: ImageIntent, workspace: dict = Depends(require_workspace_access),
                 user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).image_intent(workspace, user, run_id, item_id, payload)


@router.post("/runs/{run_id}/items/{item_id}/image-asset", response_model=RunItem)
def attach_image(run_id: str, item_id: str, payload: ImageAsset, workspace: dict = Depends(require_workspace_access),
                 user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).attach_image(workspace, user, run_id, item_id, payload)


@router.patch("/runs/{run_id}/items/{item_id}/slot", response_model=RunItem)
def edit_slot(run_id: str, item_id: str, payload: SlotEdit, workspace: dict = Depends(require_workspace_access),
              user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).edit_slot(workspace, user, run_id, item_id, payload)


@router.post("/runs/{run_id}/schedule/preview", response_model=SchedulePreview)
def schedule_preview(run_id: str, payload: ScheduleSelection, workspace: dict = Depends(require_workspace_access),
                     user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).schedule_preview(workspace, user, run_id, payload.itemIds, payload.conflictAcknowledgments)


@router.post("/runs/{run_id}/schedule/confirm", response_model=ScheduleResult)
def schedule_confirm(run_id: str, payload: ScheduleConfirm, workspace: dict = Depends(require_workspace_access),
                     user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).confirm_schedule(workspace, user, run_id, payload)


@router.post("/runs/{run_id}/schedule/retry", response_model=ScheduleResult)
def schedule_retry(run_id: str, payload: ScheduleRetry, workspace: dict = Depends(require_workspace_access),
                   user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return ContentPlanRuns(db).retry_schedule(workspace, user, run_id, payload)