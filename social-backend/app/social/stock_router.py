from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database

from app.auth.deps import get_current_user
from app.core.database import get_db
from app.social import stock
from app.social.schemas import MediaAssetOut, StockImportRequest, StockProvidersOut, StockSearchOut
from app.workspaces.deps import require_workspace_access


router = APIRouter(prefix="/stock", tags=["stock-media"])


@router.get("/providers", response_model=StockProvidersOut, response_model_exclude_none=True)
def providers(workspace: dict = Depends(require_workspace_access)):
    return stock.providers()


@router.get("/search", response_model=StockSearchOut, response_model_exclude_none=True)
def search(query: str = Query(min_length=1, max_length=200),
           mediaType: Literal["image", "video"] = "image", page: int = Query(1, ge=1, le=1000),
           pageSize: int = Query(24, ge=1, le=80), workspace: dict = Depends(require_workspace_access)):
    if not query.strip():
        raise HTTPException(422, "Search query cannot be blank")
    return stock.search(query, mediaType, page, pageSize)


@router.post("/import", response_model=MediaAssetOut)
def import_asset(payload: StockImportRequest, workspace: dict = Depends(require_workspace_access),
                 user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return stock.import_asset(db, workspace, user, payload)