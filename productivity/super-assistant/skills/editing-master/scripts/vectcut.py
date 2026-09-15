#!/usr/bin/env python3
"""JSON command-line entry point for the local VectCut editing tools."""

from __future__ import annotations

import argparse
import contextlib
from dataclasses import dataclass
import inspect
import io
import json
import os
from pathlib import Path
import sys
import traceback
from typing import Callable


SCRIPT_DIR = Path(__file__).resolve().parent
ENGINE_DIR = SCRIPT_DIR / "engine"
for import_root in (SCRIPT_DIR, ENGINE_DIR):
    import_root_text = str(import_root)
    if import_root_text not in sys.path:
        sys.path.insert(0, import_root_text)


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


@dataclass(frozen=True)
class Tool:
    category: str
    function: Callable
    description: str


def _normalize_profile(value: str) -> str:
    key = value.strip().lower().replace(".", "_").replace("-", "_")
    if key not in PROFILE_ALIASES:
        supported = ", ".join(sorted(PROFILE_ALIASES))
        raise ValueError(f"Unknown profile '{value}'. Supported values: {supported}")
    return PROFILE_ALIASES[key]


def _read_params(args: argparse.Namespace) -> dict:
    if args.command != "run":
        return {}
    if args.params_file:
        if args.params_file == "-":
            raw = sys.stdin.read()
        else:
            raw = Path(args.params_file).expanduser().read_text(encoding="utf-8")
    else:
        raw = args.params or "{}"
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Tool parameters must be a JSON object")
    return value


def _stored_profile(workspace: Path, draft_id: str | None) -> str | None:
    if not draft_id:
        return None
    path = workspace / ".vectcut" / "state" / f"{draft_id}.json"
    if not path.is_file():
        return None
    metadata = json.loads(path.read_text(encoding="utf-8"))
    return metadata.get("profile")


def _select_profile(
    requested: str | None,
    workspace: Path,
    draft_id: str | None,
) -> str:
    stored = _stored_profile(workspace, draft_id)
    if requested:
        normalized = _normalize_profile(requested)
        if stored and stored != normalized:
            raise ValueError(
                f"Draft '{draft_id}' uses profile '{stored}', not '{normalized}'"
            )
        return normalized
    return stored or "capcut_legacy"


def _create_draft(width: int = 1080, height: int = 1920) -> dict:
    """Create a persistent video draft with the requested canvas size."""
    from tools.draft.create_draft import get_or_create_draft

    draft_id, _script = get_or_create_draft(width=width, height=height)
    return {"draft_id": draft_id, "width": width, "height": height}


def _registry() -> dict[str, Tool]:
    from tools.draft.inspect_draft import inspect_draft, list_drafts
    from tools.draft.save_draft import save_draft_impl
    from tools.effects.add_effect import add_effect_impl
    from tools.effects.add_sticker import add_sticker_impl
    from tools.effects.add_video_keyframe import add_video_keyframe_impl
    from tools.media.add_audio import add_audio_track
    from tools.media.add_image import add_image_impl
    from tools.media.add_video import add_video_track
    from tools.media.get_duration import get_video_duration
    from tools.metadata.list_resources import (
        get_audio_effect_types,
        get_combo_animation_types,
        get_font_types,
        get_intro_animation_types,
        get_mask_types,
        get_outro_animation_types,
        get_text_intro_types,
        get_text_loop_anim_types,
        get_text_outro_types,
        get_transition_types,
        get_video_character_effect_types,
        get_video_scene_effect_types,
    )
    from tools.text.add_subtitle import add_subtitle_impl
    from tools.text.add_text import add_text_impl

    return {
        "create_draft": Tool("draft", _create_draft, "创建持久化视频草稿"),
        "list_drafts": Tool("draft", list_drafts, "列出工作目录中的草稿"),
        "inspect_draft": Tool("draft", inspect_draft, "读取完整草稿 JSON"),
        "save_draft": Tool("draft", save_draft_impl, "保存本地剪映/CapCut 草稿目录"),
        "add_video": Tool("media", add_video_track, "添加视频、转场、蒙版或背景模糊"),
        "add_audio": Tool("media", add_audio_track, "添加音频并可应用声音效果"),
        "add_image": Tool("media", add_image_impl, "添加图片、动画、转场或蒙版"),
        "get_video_duration": Tool("media", get_video_duration, "使用 ffprobe 获取媒体时长"),
        "add_text": Tool("text", add_text_impl, "添加文本、样式、背景、阴影或文字动画"),
        "add_subtitle": Tool("text", add_subtitle_impl, "从 SRT 文件、URL 或文本添加字幕"),
        "add_effect": Tool("effects", add_effect_impl, "添加场景或人物视频特效"),
        "add_sticker": Tool("effects", add_sticker_impl, "按资源 ID 添加贴纸"),
        "add_video_keyframe": Tool("effects", add_video_keyframe_impl, "添加单个或批量关键帧"),
        "get_intro_animation_types": Tool("metadata", get_intro_animation_types, "列出入场动画"),
        "get_outro_animation_types": Tool("metadata", get_outro_animation_types, "列出出场动画"),
        "get_combo_animation_types": Tool("metadata", get_combo_animation_types, "列出组合动画"),
        "get_transition_types": Tool("metadata", get_transition_types, "列出转场"),
        "get_mask_types": Tool("metadata", get_mask_types, "列出蒙版"),
        "get_audio_effect_types": Tool("metadata", get_audio_effect_types, "列出音频效果及参数"),
        "get_font_types": Tool("metadata", get_font_types, "列出字体"),
        "get_text_intro_types": Tool("metadata", get_text_intro_types, "列出文字入场动画"),
        "get_text_outro_types": Tool("metadata", get_text_outro_types, "列出文字出场动画"),
        "get_text_loop_anim_types": Tool("metadata", get_text_loop_anim_types, "列出文字循环动画"),
        "get_video_scene_effect_types": Tool("metadata", get_video_scene_effect_types, "列出场景特效"),
        "get_video_character_effect_types": Tool("metadata", get_video_character_effect_types, "列出人物特效"),
    }


def _json_default(value):
    if value is inspect.Parameter.empty:
        return None
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return repr(value)


def _tool_info(name: str, tool: Tool) -> dict:
    signature = inspect.signature(tool.function)
    parameters = []
    for parameter in signature.parameters.values():
        item = {
            "name": parameter.name,
            "required": parameter.default is inspect.Parameter.empty,
            "type": inspect.formatannotation(parameter.annotation),
        }
        if parameter.default is not inspect.Parameter.empty:
            item["default"] = _json_default(parameter.default)
        parameters.append(item)
    return {
        "name": name,
        "category": tool.category,
        "description": tool.description,
        "signature": f"{name}{signature}",
        "parameters": parameters,
    }


def _convert_text_styles(items: list[dict]) -> list:
    from core.util import hex_to_rgb
    from pyJianYingDraft import Text_border, Text_style
    from pyJianYingDraft.text_segment import TextStyleRange

    ranges = []
    for item in items:
        style = Text_style(
            size=item.get("font_size", 8.0),
            bold=item.get("bold", False),
            italic=item.get("italic", False),
            underline=item.get("underline", False),
            color=hex_to_rgb(item.get("font_color", "#ffffff")),
            alpha=item.get("font_alpha", 1.0),
            align=item.get("align", 1),
            vertical=item.get("vertical", False),
        )
        border = None
        if item.get("border_width", 0) > 0:
            border = Text_border(
                alpha=item.get("border_alpha", 1.0),
                color=hex_to_rgb(item.get("border_color", "#000000")),
                width=item["border_width"],
            )
        ranges.append(
            TextStyleRange(
                start=item["start"],
                end=item["end"],
                style=style,
                border=border,
                font_str=item.get("font"),
            )
        )
    return ranges


def _run_tool(
    name: str,
    tool: Tool,
    params: dict,
    workspace: Path,
    profile: str,
    verbose: bool,
) -> tuple[dict, int]:
    from core.draft_cache import (
        configure_workspace,
        load_draft,
        persist_draft,
        state_path,
    )

    configure_workspace(workspace)
    draft_id = params.get("draft_id")
    state_independent = {
        "create_draft",
        "list_drafts",
        "get_video_duration",
        "get_intro_animation_types",
        "get_outro_animation_types",
        "get_combo_animation_types",
        "get_transition_types",
        "get_mask_types",
        "get_audio_effect_types",
        "get_font_types",
        "get_text_intro_types",
        "get_text_outro_types",
        "get_text_loop_anim_types",
        "get_video_scene_effect_types",
        "get_video_character_effect_types",
    }
    if draft_id and name not in state_independent:
        load_draft(draft_id)

    if name == "save_draft":
        output_dir = params.pop("output_dir", None)
        if output_dir and "draft_folder" in params:
            raise ValueError("Use only one of output_dir or draft_folder")
        params.setdefault(
            "draft_folder",
            str(Path(output_dir).expanduser().resolve())
            if output_dir
            else str((workspace / "drafts").resolve()),
        )
    if name == "add_text" and params.get("text_styles"):
        params["text_styles"] = _convert_text_styles(params["text_styles"])

    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        result = tool.function(**params)

    result_draft_id = result.get("draft_id") if isinstance(result, dict) else None
    if result_draft_id:
        persisted = persist_draft(result_draft_id, profile)
        if isinstance(result, dict):
            result.pop("draft_url", None)
            result["state_path"] = str(persisted)
            result["profile"] = profile

    success = not (
        isinstance(result, dict) and result.get("success") is False
    )
    response = {
        "success": success,
        "tool": name,
        "workspace": str(workspace),
        "result": result,
    }
    if not success:
        response["error"] = (
            result.get("error", "Tool reported a failure")
            if isinstance(result, dict)
            else "Tool reported a failure"
        )
        response["error_type"] = "ToolError"
    if verbose and captured.getvalue().strip():
        response["logs"] = captured.getvalue().strip().splitlines()
    if result_draft_id and not isinstance(result, dict):
        response["state_path"] = str(state_path(result_draft_id))
    return response, 0 if success else 1


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run VectCut video-editing tools locally without MCP or an HTTP service."
    )
    parser.add_argument(
        "--workspace",
        default=os.getcwd(),
        help="Directory for persistent state and exported drafts (default: current directory)",
    )
    parser.add_argument(
        "--profile",
        help="capcut_legacy, jianying_legacy, or jianying_pro_10",
    )
    parser.add_argument("--verbose", action="store_true", help="Include tool logs and tracebacks")

    commands = parser.add_subparsers(dest="command", required=True)
    list_parser = commands.add_parser("list-tools", help="List tools and their parameters")
    list_parser.add_argument("--tool", help="Show one tool only")

    run_parser = commands.add_parser("run", help="Run one tool with JSON parameters")
    run_parser.add_argument("tool", help="Tool name from list-tools")
    params_group = run_parser.add_mutually_exclusive_group()
    params_group.add_argument("--params", help="Inline JSON object")
    params_group.add_argument(
        "--params-file",
        help="Path to a JSON file, or - to read JSON from stdin",
    )
    return parser


def main() -> int:
    args = _parser().parse_args()
    try:
        params = _read_params(args)
        workspace = Path(args.workspace).expanduser().resolve()
        profile = _select_profile(args.profile, workspace, params.get("draft_id"))
        os.environ["VECTCUT_DRAFT_PROFILE"] = profile

        registry = _registry()
        if args.command == "list-tools":
            if args.tool:
                if args.tool not in registry:
                    raise KeyError(f"Unknown tool '{args.tool}'")
                result = _tool_info(args.tool, registry[args.tool])
            else:
                result = [_tool_info(name, tool) for name, tool in registry.items()]
            print(json.dumps({"success": True, "tools": result}, ensure_ascii=False, indent=2))
            return 0

        if args.tool not in registry:
            raise KeyError(f"Unknown tool '{args.tool}'. Run list-tools first.")
        response, exit_code = _run_tool(
            args.tool,
            registry[args.tool],
            params,
            workspace,
            profile,
            args.verbose,
        )
        print(json.dumps(response, ensure_ascii=False, indent=2, default=str))
        return exit_code
    except Exception as exc:
        error = {
            "success": False,
            "error": str(exc),
            "error_type": type(exc).__name__,
        }
        if getattr(args, "verbose", False):
            error["traceback"] = traceback.format_exc().splitlines()
        print(json.dumps(error, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
