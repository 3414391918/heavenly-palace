"""In-memory and on-disk draft state used by the command-line tools."""

from collections import OrderedDict
import json
import os
from pathlib import Path
import pickle
from typing import Dict, Optional

import pyJianYingDraft as draft


DRAFT_CACHE: Dict[str, "draft.Script_file"] = OrderedDict()
MAX_CACHE_SIZE = 10000
_workspace = Path.cwd().resolve()


def configure_workspace(path: os.PathLike | str) -> Path:
    """Set and create the workspace used for persistent draft state."""
    global _workspace
    _workspace = Path(path).expanduser().resolve()
    state_dir().mkdir(parents=True, exist_ok=True)
    return _workspace


def workspace() -> Path:
    return _workspace


def state_dir() -> Path:
    return _workspace / ".vectcut" / "state"


def state_path(draft_id: str) -> Path:
    return state_dir() / f"{draft_id}.pickle"


def metadata_path(draft_id: str) -> Path:
    return state_dir() / f"{draft_id}.json"


def update_cache(key: str, value: "draft.Script_file") -> None:
    """Update the process-local LRU cache."""
    if key in DRAFT_CACHE:
        DRAFT_CACHE.pop(key)
    elif len(DRAFT_CACHE) >= MAX_CACHE_SIZE:
        DRAFT_CACHE.popitem(last=False)
    DRAFT_CACHE[key] = value


def persist_draft(draft_id: str, profile: str) -> Path:
    """Atomically persist a trusted local draft for the next CLI invocation."""
    if draft_id not in DRAFT_CACHE:
        raise KeyError(f"Draft '{draft_id}' is not loaded")

    state_dir().mkdir(parents=True, exist_ok=True)
    target = state_path(draft_id)
    temporary = target.with_suffix(".pickle.tmp")
    with temporary.open("wb") as handle:
        pickle.dump(DRAFT_CACHE[draft_id], handle, protocol=pickle.HIGHEST_PROTOCOL)
    os.replace(temporary, target)

    metadata = {
        "draft_id": draft_id,
        "profile": profile,
        "state_path": str(target),
    }
    metadata_target = metadata_path(draft_id)
    metadata_temporary = metadata_target.with_suffix(".json.tmp")
    metadata_temporary.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(metadata_temporary, metadata_target)
    return target


def load_draft(draft_id: str) -> "draft.Script_file":
    """Load a draft created by this skill into the process-local cache."""
    target = state_path(draft_id)
    if not target.is_file():
        raise FileNotFoundError(
            f"Draft state '{draft_id}' was not found in {state_dir()}"
        )
    with target.open("rb") as handle:
        script = pickle.load(handle)
    update_cache(draft_id, script)
    return script


def read_metadata(draft_id: str) -> Optional[dict]:
    target = metadata_path(draft_id)
    if not target.is_file():
        return None
    return json.loads(target.read_text(encoding="utf-8"))


def list_drafts() -> list[dict]:
    """List persisted drafts without loading their pickle state."""
    if not state_dir().is_dir():
        return []
    drafts = []
    for path in sorted(state_dir().glob("*.json")):
        try:
            drafts.append(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            continue
    return drafts
