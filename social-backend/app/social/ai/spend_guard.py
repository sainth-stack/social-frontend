"""Optional spend cap for benchmark / batch image runs."""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

from app.core.config import settings

_active_cap: ContextVar[float | None] = ContextVar("image_spend_cap", default=None)
_spent: ContextVar[float] = ContextVar("image_spend_spent", default=0.0)


class BenchmarkSpendExceeded(RuntimeError):
    def __init__(self, spent: float, cap: float):
        super().__init__(f"Benchmark spend cap reached ({spent:.2f} >= {cap:.2f} USD)")
        self.spent = spent
        self.cap = cap


@dataclass
class SpendSnapshot:
    spent_usd: float
    cap_usd: float | None


def current_spend() -> SpendSnapshot:
    return SpendSnapshot(spent_usd=float(_spent.get()), cap_usd=_active_cap.get())


def record_estimated_image_cost() -> None:
    cap = _active_cap.get()
    if cap is None:
        return
    estimate = float(settings.image_estimated_cost_usd or 0)
    new_spent = float(_spent.get()) + estimate
    _spent.set(new_spent)
    if new_spent > cap:
        raise BenchmarkSpendExceeded(new_spent, cap)


def assert_can_spend() -> None:
    cap = _active_cap.get()
    if cap is None:
        return
    if float(_spent.get()) >= cap:
        raise BenchmarkSpendExceeded(float(_spent.get()), cap)


@contextmanager
def benchmark_spend_budget(max_usd: float | None = None):
    cap = max_usd if max_usd is not None else settings.benchmark_max_spend_usd
    token_cap = _active_cap.set(float(cap) if cap is not None and cap > 0 else None)
    token_spent = _spent.set(0.0)
    try:
        yield current_spend()
    finally:
        _active_cap.reset(token_cap)
        _spent.reset(token_spent)