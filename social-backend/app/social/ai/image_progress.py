from contextlib import contextmanager
from contextvars import ContextVar


_progress = ContextVar("image_progress", default=None)
_art_direction = ContextVar("image_art_direction", default=False)


@contextmanager
def image_progress(callback, *, art_direction=False):
    progress_token = _progress.set(callback)
    direction_token = _art_direction.set(art_direction)
    try:
        yield
    finally:
        _art_direction.reset(direction_token)
        _progress.reset(progress_token)


def report_image_stage(stage):
    callback = _progress.get()
    if callback:
        callback(stage)


def image_art_direction():
    return _art_direction.get()