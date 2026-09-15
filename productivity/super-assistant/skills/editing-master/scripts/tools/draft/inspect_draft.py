"""Read-only draft inspection helpers."""

import json

from core.draft_cache import DRAFT_CACHE, list_drafts as list_persisted_drafts
from core.draft_profiles import get_draft_profile


def inspect_draft(draft_id: str) -> dict:
    """Return the complete JSON representation of a loaded draft."""
    if draft_id not in DRAFT_CACHE:
        raise KeyError(f"Draft '{draft_id}' is not loaded")
    script = DRAFT_CACHE[draft_id]
    return json.loads(script.dumps(get_draft_profile()))


def list_drafts() -> list[dict]:
    """List draft IDs persisted in the selected workspace."""
    return list_persisted_drafts()
