"""Runtime configuration for the local, service-free VectCut tools."""

import os


PROFILE_ALIASES = {
    "capcut": "capcut_legacy",
    "capcut_legacy": "capcut_legacy",
    "jianying": "jianying_legacy",
    "jianying_legacy": "jianying_legacy",
    "jianying_10": "jianying_pro_10",
    "jianying_10_x": "jianying_pro_10",
    "jianying_pro_10": "jianying_pro_10",
    "jianying_pro_10_2": "jianying_pro_10",
    "jianying_pro_10_2_0": "jianying_pro_10",
}


def _normalize_profile(value: str) -> str:
    key = value.strip().lower().replace(".", "_").replace("-", "_")
    if key not in PROFILE_ALIASES:
        supported = ", ".join(sorted(PROFILE_ALIASES))
        raise ValueError(f"Unknown draft profile '{value}'. Supported values: {supported}")
    return PROFILE_ALIASES[key]


DRAFT_PROFILE = _normalize_profile(os.environ.get("VECTCUT_DRAFT_PROFILE", "capcut_legacy"))
IS_CAPCUT_ENV = DRAFT_PROFILE == "capcut_legacy"

# Kept for compatibility with the underlying editing functions. The local CLI
# replaces this preview URL with a state path in its JSON response.
DRAFT_DOMAIN = "vectcut://local"
PREVIEW_ROUTER = "/draft"
IS_UPLOAD_DRAFT = False

