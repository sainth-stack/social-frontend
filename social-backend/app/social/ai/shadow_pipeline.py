"""Run accuracy pipeline in background without affecting the user response (sampled)."""
from __future__ import annotations

import logging
import random
import threading
from typing import Any, Callable

from app.core.config import settings

logger = logging.getLogger(__name__)


def maybe_run_shadow(run: Callable[[], dict[str, Any]], *, label: str) -> None:
    if not settings.image_shadow_mode:
        return
    if settings.image_shadow_sample_percent <= 0:
        return
    if random.randint(1, 100) > settings.image_shadow_sample_percent:
        return

    def worker() -> None:
        try:
            summary = run()
            logger.info("image_shadow label=%s summary=%s", label, summary)
        except Exception as exc:
            logger.warning("image_shadow failed label=%s type=%s", label, type(exc).__name__)

    threading.Thread(target=worker, name=f"image-shadow-{label}", daemon=True).start()