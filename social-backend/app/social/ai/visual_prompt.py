from __future__ import annotations

import re


def compact_context(value: str | None, budget: int) -> str:
    text = " ".join((value or "").split())
    if len(text) <= budget:
        return text
    sentences = re.split(r"(?<=[.!?;])\s+|\n+", value or "")
    constraints = [" ".join(sentence.split()) for sentence in sentences if re.search(r"\b(no|not|never|avoid|only|must|without|keep|do not)\b", sentence, re.I)]
    tail_budget = min(budget // 3, 600)
    constraint_budget = budget // 3
    selected = " ".join(constraints)
    if len(selected) > constraint_budget:
        selected = selected[:constraint_budget // 2] + " … " + selected[-constraint_budget // 2:]
    middle = f" Constraints: {selected}" if selected else ""
    head_budget = budget - tail_budget - len(middle) - 6
    return text[:head_budget] + " … " + text[-tail_budget:] + middle