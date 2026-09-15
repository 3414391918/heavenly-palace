#!/usr/bin/env python3
"""持久化、校验并渲染「跨应用双向调用图」的会话状态。

本脚本围绕一个 JSON「会话文件」工作，用于增量式地构建方法级调用图：
- upstream（上游）：谁调用了当前方法（调用者方向）；
- downstream（下游）：当前方法调用了谁（被调用者方向）。

它以子命令方式对外提供能力（见文件末尾的 build_parser）：
  init      创建新会话，登记入口方法；
  next      给出下一个待展开的一跳任务（供 AI/调用方逐跳推进）；
  expand    原子地写入某个节点某方向的一跳发现（新增节点/边、推进状态）；
  terminal  将某节点某方向标记为已核实的边界（不再向外扩展）；
  block     记录一个需要用户确认的疑问，挂起对应节点；
  confirm   用用户的回答解决一个 open 的 block；
  set-budget 提升遍历预算（只能增大，不能减小）；
  status    输出覆盖率、frontier 与未决项统计；
  validate  校验图结构（可选校验完整性）；
  render    渲染为便于 AI 阅读的 Markdown 事实清单。

关键设计：所有写操作都通过原子写盘（atomic_write_json）落地，保证会话文件不被写坏；
跨应用边（RPC/HTTP/MQ 等）有更严格的证据要求，以降低误判。
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import os
from pathlib import Path
import sys
import tempfile
from typing import Any, Iterable


# 会话文件的 schema 版本号；加载时会校验一致，防止读到不兼容的旧格式。
SCHEMA_VERSION = 1
# 两个遍历方向：上游（调用者）与下游（被调用者）。
DIRECTIONS = ("upstream", "downstream")
# 「活跃」状态：节点在该方向上仍待展开，应出现在 frontier 队列中。
ACTIVE_STATES = {"pending", "in_progress"}
# 「未完成」状态：只要还有这些状态的节点，整图就不算彻底分析完毕。
INCOMPLETE_STATES = {"pending", "in_progress", "unresolved", "deferred"}
# 节点在某个方向上允许出现的全部合法状态。
VALID_STATES = {"unseen", "pending", "in_progress", "expanded", "terminal", "unresolved", "deferred"}
# 边的置信度取值：已确认 / 可能 / 未解析。
VALID_CONFIDENCE = {"confirmed", "probable", "unresolved"}
# 允许作为「跨应用边」的边类型（远程/异步调用等）。
CROSS_APP_TYPES = {"rpc", "http", "grpc", "mq", "event", "cross_app"}
# 默认遍历预算：约束图规模与深度，防止分析无限膨胀。
DEFAULT_CONFIG = {
    "max_nodes": 10000,        # 最大节点数
    "max_edges": 30000,        # 最大边数
    "max_apps": 50,            # 最大涉及应用数
    "max_depth_upstream": 100, # 上游最大深度
    "max_depth_downstream": 100, # 下游最大深度
    "max_batch_fanout": 200,   # 单次 expand 提交的邻居数上限
}


class SessionError(Exception):
    """用户可纠正的会话/输入错误（对应退出码 2）。"""


class BudgetError(SessionError):
    """扩展将超出显式设定的分析预算（对应退出码 3）。"""


def utc_now() -> str:
    """返回当前 UTC 时间的 ISO8601 字符串（秒级精度，去掉微秒）。"""
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> Any:
    """读取并解析 JSON 文件；文件缺失或格式非法时抛出 SessionError。"""
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:
        raise SessionError(f"file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SessionError(f"invalid JSON in {path}: {exc}") from exc


def atomic_write_json(path: Path, value: Any) -> None:
    """原子地将 value 序列化为 JSON 写入 path。

    先写入同目录下的临时文件并 fsync 刷盘，再用 os.replace 原子替换目标文件，
    从而避免写入过程中程序崩溃导致会话文件半写坏。出错时清理临时文件并向上抛出。
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def load_session(path: Path) -> dict[str, Any]:
    """加载会话文件并校验 schema_version 是否匹配。"""
    session = load_json(path)
    if not isinstance(session, dict) or session.get("schema_version") != SCHEMA_VERSION:
        raise SessionError(f"unsupported or missing schema_version in {path}")
    return session


def save_session(path: Path, session: dict[str, Any]) -> None:
    """更新 updated_at 时间戳并原子写回会话文件。"""
    session["updated_at"] = utc_now()
    atomic_write_json(path, session)


def validate_app_name(app: str) -> None:
    """校验应用名：非空、不含分隔符 '::'、且首尾无空白。"""
    if not app or "::" in app or app.strip() != app:
        raise SessionError("application name must be non-empty and cannot contain '::' or outer whitespace")


def validate_method(method: str) -> None:
    """校验方法必须是完整签名，形如 com.acme.Service#run(java.lang.String):void。"""
    if not method or "#" not in method or "(" not in method or ")" not in method:
        raise SessionError(
            "method must be a full signature like com.acme.Service#run(java.lang.String):void"
        )


def canonical_id(app: str, method: str) -> str:
    """由应用名与方法签名拼出节点的规范 id：`{app}::{method}`。"""
    validate_app_name(app)
    validate_method(method)
    return f"{app}::{method}"


def split_id(node_id: str) -> tuple[str, str]:
    """将规范节点 id 反向拆分为 (应用名, 方法签名)，并校验其规范性。"""
    if "::" not in node_id:
        raise SessionError(f"invalid node id: {node_id}")
    app, method = node_id.split("::", 1)
    if canonical_id(app, method) != node_id:
        raise SessionError(f"invalid canonical node id: {node_id}")
    return app, method


def absolute_project(path_text: str) -> str:
    """将项目路径规整为绝对路径，并要求该目录真实存在。"""
    path = Path(path_text).expanduser().resolve()
    if not path.is_dir():
        raise SessionError(f"project directory does not exist: {path}")
    return str(path)


def application_record(project_path: str) -> dict[str, Any]:
    """构造 applications 表中一个应用的记录（项目路径 + 是否已 CodeGraph 索引）。"""
    project = Path(project_path)
    return {
        "project_path": str(project),
        "codegraph_indexed": (project / ".codegraph").is_dir(),
    }


def new_node(
    app: str,
    project_path: str,
    method: str,
    kind: str = "method",
    source: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """创建一个新节点的初始结构。

    每个节点在两个方向上分别维护 state（状态）、depth（最短距离）、
    continuation（分批展开时的续传游标）与 terminal（边界信息）。
    初始状态均为 unseen（尚未被任何方向触达）。
    """
    return {
        "id": canonical_id(app, method),
        "app": app,
        "project_path": project_path,
        "method": method,
        "kind": kind,
        "source": source or {},
        "state": {direction: "unseen" for direction in DIRECTIONS},
        "depth": {direction: None for direction in DIRECTIONS},
        "continuation": {direction: None for direction in DIRECTIONS},
        "terminal": {},
    }


def init_session(args: argparse.Namespace) -> None:
    """`init` 子命令：创建一个新会话文件，登记入口方法为起点。

    入口节点在 upstream/downstream 两个方向上均置为 pending、深度 0，
    从而进入两个方向的 frontier；预算由 DEFAULT_CONFIG 叠加命令行覆盖值确定。
    若目标会话文件已存在且未传 --force，则拒绝覆盖。
    """
    output = Path(args.session).expanduser().resolve()
    if output.exists() and not args.force:
        raise SessionError(f"session already exists: {output}; pass --force to replace it")
    project = absolute_project(args.project)
    entry_id = canonical_id(args.app, args.method)
    source: dict[str, Any] = {}
    if args.source_file:
        source["file"] = str(Path(args.source_file).expanduser().resolve())
    if args.line is not None:
        source["line"] = args.line
    entry = new_node(args.app, project, args.method, source=source)
    for direction in DIRECTIONS:
        entry["state"][direction] = "pending"
        entry["depth"][direction] = 0
    config = copy.deepcopy(DEFAULT_CONFIG)
    for key in config:
        value = getattr(args, key, None)
        if value is not None:
            if value <= 0:
                raise SessionError(f"{key} must be positive")
            config[key] = value
    session = {
        "schema_version": SCHEMA_VERSION,
        "created_at": utc_now(),
        "updated_at": utc_now(),
        "entry_id": entry_id,
        "workspace_roots": [str(Path(root).expanduser().resolve()) for root in args.workspace_root],
        "config": config,
        "applications": {args.app: application_record(project)},
        "nodes": {entry_id: entry},
        "edges": {},
        "frontier": {direction: [entry_id] for direction in DIRECTIONS},
        "blocks": [],
        "confirmations": [],
    }
    atomic_write_json(output, session)
    print(json.dumps({"session": str(output), "entry_id": entry_id, "config": config}, ensure_ascii=False))


def next_node(args: argparse.Namespace) -> None:
    """`next` 子命令：在指定方向的 frontier 中挑出下一个待展开的一跳任务。

    每个方向最多返回一个处于活跃状态（pending/in_progress）的节点，
    供调用方据此去做一跳的调用关系分析。
    """
    session = load_session(Path(args.session))
    directions = DIRECTIONS if args.direction == "both" else (args.direction,)
    result = []
    for direction in directions:
        for node_id in session["frontier"][direction]:
            node = session["nodes"][node_id]
            if node["state"][direction] in ACTIVE_STATES:
                result.append(
                    {
                        "direction": direction,
                        "node_id": node_id,
                        "app": node["app"],
                        "project_path": node["project_path"],
                        "method": node["method"],
                        "depth": node["depth"][direction],
                        "state": node["state"][direction],
                        "continuation": node["continuation"][direction],
                    }
                )
                break
    print(json.dumps({"next": result}, ensure_ascii=False, indent=2))


def normalized_evidence(value: Any) -> list[dict[str, str]]:
    """规范化并校验证据数组。

    每条证据须为含非空 kind/detail 的对象；结果去重后返回。
    整个证据数组不得为空——每条边都必须有支撑证据。
    """
    if not isinstance(value, list) or not value:
        raise SessionError("every edge must include a non-empty evidence array")
    result: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            raise SessionError("evidence items must be objects")
        kind = str(item.get("kind", "")).strip()
        detail = str(item.get("detail", "")).strip()
        if not kind or not detail:
            raise SessionError("evidence items require non-empty kind and detail")
        record = {"kind": kind, "detail": detail}
        if record not in result:
            result.append(record)
    return result


def cross_app_evidence_is_complete(evidence: Iterable[dict[str, str]]) -> bool:
    """判断跨应用边的证据是否「完整」到可标记为 confirmed。

    要求同时具备：contract（契约/接口定义）、implementation（实现），
    以及 registration/configuration/user_confirmation 三者之一（注册/配置/用户确认）。
    """
    kinds = {item["kind"] for item in evidence}
    return (
        "contract" in kinds
        and "implementation" in kinds
        and bool(kinds & {"registration", "configuration", "user_confirmation"})
    )


def edge_key(caller: str, callee: str, edge_type: str) -> str:
    """生成边的唯一键：`caller→callee|edge_type`（用箭头符号连接）。"""
    return f"{caller}\u2192{callee}|{edge_type}"


def append_unique(target: list[Any], values: Iterable[Any]) -> None:
    """将 values 中尚不存在于 target 的元素依次追加进去（保序去重）。"""
    for value in values:
        if value not in target:
            target.append(value)


def remove_frontier(session: dict[str, Any], direction: str, node_id: str) -> None:
    """将某节点从指定方向的 frontier 队列中移除。"""
    session["frontier"][direction] = [item for item in session["frontier"][direction] if item != node_id]


def enqueue(session: dict[str, Any], direction: str, node_id: str) -> None:
    """将某节点加入指定方向的 frontier 队列（已存在则不重复入队）。"""
    if node_id not in session["frontier"][direction]:
        session["frontier"][direction].append(node_id)


def next_block_id(session: dict[str, Any]) -> str:
    """基于现有 block 编号生成下一个 block id，形如 B0001、B0002 …"""
    maximum = 0
    for block in session["blocks"]:
        value = str(block.get("id", ""))
        if value.startswith("B") and value[1:].isdigit():
            maximum = max(maximum, int(value[1:]))
    return f"B{maximum + 1:04d}"


def add_block_record(
    session: dict[str, Any],
    node_id: str,
    direction: str,
    question: str,
    candidates: Any,
    reason: str,
    related_edge: str | None = None,
) -> str:
    """向会话追加一条 block（未决疑问）记录，返回其自动分配的 block id。"""
    block_id = next_block_id(session)
    session["blocks"].append(
        {
            "id": block_id,
            "status": "open",
            "node_id": node_id,
            "direction": direction,
            "reason": reason,
            "question": question,
            "candidates": candidates,
            "related_edge": related_edge,
            "created_at": utc_now(),
        }
    )
    return block_id


def validate_neighbor(item: Any, source_app: str) -> dict[str, Any]:
    """校验并规范化一次 expand 提交中的单个邻居条目。

    这里做集中校验，包括：
    - 邻居的 app/method 是否能拼出合法节点 id、可选 node_id 是否一致；
    - project_path 必须是已存在的绝对目录；
    - edge_type 非空；跨应用时必须是 CROSS_APP_TYPES 之一；
    - confidence 必须合法；
    - 每条边都要有非空 evidence，跨应用且 confirmed 时还需满足证据完整性；
    - 非 confirmed 邻居必须给出 question（进而生成 block）；
    - enqueue=false（不再向外扩展）且 confirmed 时必须给出 terminal_reason；
    - callsite 结构必须是对象。
    返回一个规范化后的 dict，供 expand() 使用。
    """
    if not isinstance(item, dict):
        raise SessionError("neighbors must contain JSON objects")
    app = str(item.get("app", ""))
    method = str(item.get("method", ""))
    target_id = canonical_id(app, method)
    supplied_id = item.get("node_id")
    if supplied_id is not None and supplied_id != target_id:
        raise SessionError(f"neighbor node_id does not match app + method: {supplied_id}")
    project_path = absolute_project(str(item.get("project_path", "")))
    edge_type = str(item.get("edge_type", "call")).strip()
    if not edge_type:
        raise SessionError(f"edge_type is empty for {target_id}")
    confidence = str(item.get("confidence", "confirmed"))
    if confidence not in VALID_CONFIDENCE:
        raise SessionError(f"invalid confidence for {target_id}: {confidence}")
    evidence = normalized_evidence(item.get("evidence"))
    cross_app = app != source_app
    if cross_app and edge_type not in CROSS_APP_TYPES:
        raise SessionError(
            f"cross-application edge {target_id} must use one of {sorted(CROSS_APP_TYPES)}, got {edge_type}"
        )
    if cross_app and confidence == "confirmed" and not cross_app_evidence_is_complete(evidence):
        raise SessionError(
            f"confirmed cross-application edge {target_id} requires contract, implementation, and "
            "registration/configuration/user_confirmation evidence"
        )
    question = str(item.get("question", "")).strip()
    if confidence != "confirmed" and not question:
        raise SessionError(f"non-confirmed neighbor {target_id} requires a question")
    enqueue_value = bool(item.get("enqueue", True))
    terminal_reason = str(item.get("terminal_reason", "")).strip()
    if not enqueue_value and not terminal_reason and confidence == "confirmed":
        raise SessionError(f"neighbor {target_id} with enqueue=false requires terminal_reason")
    callsite = item.get("callsite") or {}
    if not isinstance(callsite, dict):
        raise SessionError(f"callsite for {target_id} must be an object")
    return {
        "id": target_id,
        "app": app,
        "project_path": project_path,
        "method": method,
        "kind": str(item.get("kind", "method")),
        "source": item.get("source") if isinstance(item.get("source"), dict) else {},
        "edge_type": edge_type,
        "confidence": confidence,
        "evidence": evidence,
        "branch": str(item.get("branch", "")).strip(),
        "callsite": callsite,
        "enqueue": enqueue_value,
        "terminal_reason": terminal_reason,
        "question": question,
        "candidates": item.get("candidates", []),
    }


def budget_precheck(
    session: dict[str, Any],
    source: dict[str, Any],
    direction: str,
    neighbors: list[dict[str, Any]],
) -> None:
    """在写入前预估本次 expand 是否会突破任一预算，若会则抛 BudgetError。

    预估维度：单批 fan-out、总节点数、总边数、总应用数以及方向深度上限。
    分批提交（complete=false）可用来绕开 max_batch_fanout。
    """
    config = session["config"]
    if len(neighbors) > config["max_batch_fanout"]:
        raise BudgetError(
            f"batch fan-out {len(neighbors)} exceeds max_batch_fanout={config['max_batch_fanout']}; "
            "submit multiple batches with complete=false"
        )
    new_nodes = {item["id"] for item in neighbors if item["id"] not in session["nodes"]}
    new_apps = {item["app"] for item in neighbors if item["app"] not in session["applications"]}
    new_edges: set[str] = set()
    for item in neighbors:
        caller, callee = (source["id"], item["id"]) if direction == "downstream" else (item["id"], source["id"])
        key = edge_key(caller, callee, item["edge_type"])
        if key not in session["edges"]:
            new_edges.add(key)
    checks = (
        ("max_nodes", len(session["nodes"]) + len(new_nodes)),
        ("max_edges", len(session["edges"]) + len(new_edges)),
        ("max_apps", len(session["applications"]) + len(new_apps)),
    )
    for key, projected in checks:
        if projected > config[key]:
            raise BudgetError(f"expansion would reach {projected}, exceeding {key}={config[key]}")
    source_depth = source["depth"][direction]
    if source_depth is None:
        raise SessionError(f"source node has no {direction} depth: {source['id']}")
    max_depth = config[f"max_depth_{direction}"]
    if neighbors and source_depth + 1 > max_depth:
        raise BudgetError(
            f"expansion would reach {direction} depth {source_depth + 1}, exceeding max_depth_{direction}={max_depth}"
        )


def merge_edge(session: dict[str, Any], edge: dict[str, Any]) -> None:
    """将一条边并入会话；同键边则合并证据并按需提升置信度。"""
    key = edge_key(edge["caller"], edge["callee"], edge["edge_type"])
    existing = session["edges"].get(key)
    if existing is None:
        session["edges"][key] = edge
        return
    append_unique(existing["evidence"], edge["evidence"])
    append_unique(existing["branches"], edge["branches"])
    append_unique(existing["callsites"], edge["callsites"])
    confidence_rank = {"unresolved": 0, "probable": 1, "confirmed": 2}
    if confidence_rank[edge["confidence"]] > confidence_rank[existing["confidence"]]:
        existing["confidence"] = edge["confidence"]


def expand(args: argparse.Namespace) -> None:
    """`expand` 子命令：原子地写入某节点在某方向上的一跳发现。

    读取 --input 指定的 JSON 载荷（含 node/direction/neighbors 等），逐条校验邻居、
    做预算预检，然后：新增/复用邻居节点、合并边、更新深度与状态、为低置信度邻居生成 block；
    complete=true 时把源节点标记为 expanded 并出队，否则记录 continuation 以便续传。
    全程在内存副本上修改，最后一次性原子写回，保证失败不留下半成品。
    """
    session_path = Path(args.session)
    session = load_session(session_path)
    payload = load_json(Path(args.input))
    if not isinstance(payload, dict):
        raise SessionError("expansion input must be a JSON object")
    direction = payload.get("direction")
    if direction not in DIRECTIONS:
        raise SessionError(f"direction must be one of {DIRECTIONS}")
    node_id = str(payload.get("node_id", ""))
    source = session["nodes"].get(node_id)
    if source is None:
        raise SessionError(f"source node does not exist: {node_id}")
    if source["state"][direction] not in ACTIVE_STATES:
        raise SessionError(
            f"source node {node_id} is {source['state'][direction]} in {direction}, expected pending/in_progress"
        )
    complete = payload.get("complete")
    if not isinstance(complete, bool):
        raise SessionError("complete must be a JSON boolean")
    continuation = payload.get("continuation")
    if not complete and not str(continuation or "").strip():
        raise SessionError("partial expansion requires a non-empty continuation")
    raw_neighbors = payload.get("neighbors")
    if not isinstance(raw_neighbors, list):
        raise SessionError("neighbors must be an array")
    neighbors = [validate_neighbor(item, source["app"]) for item in raw_neighbors]
    if direction == "upstream":
        for item in neighbors:
            evidence_kinds = {entry["kind"] for entry in item["evidence"]}
            if item["terminal_reason"] and "user_confirmation" not in evidence_kinds:
                raise SessionError(
                    f"upstream terminal neighbor {item['id']} requires user_confirmation evidence"
                )
    if complete and not neighbors:
        has_directional_edge = any(
            (direction == "downstream" and edge["caller"] == node_id)
            or (direction == "upstream" and edge["callee"] == node_id)
            for edge in session["edges"].values()
        )
        if not has_directional_edge:
            raise SessionError(
                f"zero-neighbor {direction} result for {node_id} must be recorded with terminal "
                "or block; it cannot be marked expanded without a boundary decision"
            )
    budget_precheck(session, source, direction, neighbors)

    source_depth = source["depth"][direction]
    added_nodes = 0
    added_edges = 0
    created_blocks: list[str] = []
    for item in neighbors:
        app_record = session["applications"].get(item["app"])
        if app_record is not None and app_record["project_path"] != item["project_path"]:
            raise SessionError(
                f"application {item['app']} already maps to {app_record['project_path']}, "
                f"not {item['project_path']}"
            )
        if app_record is None:
            session["applications"][item["app"]] = application_record(item["project_path"])

        target = session["nodes"].get(item["id"])
        if target is None:
            target = new_node(item["app"], item["project_path"], item["method"], item["kind"], item["source"])
            session["nodes"][item["id"]] = target
            added_nodes += 1
        elif target["project_path"] != item["project_path"]:
            raise SessionError(f"node {item['id']} is associated with conflicting project paths")

        new_depth = source_depth + 1
        current_depth = target["depth"][direction]
        if current_depth is None or new_depth < current_depth:
            target["depth"][direction] = new_depth

        caller, callee = (node_id, item["id"]) if direction == "downstream" else (item["id"], node_id)
        key = edge_key(caller, callee, item["edge_type"])
        edge = {
            "caller": caller,
            "callee": callee,
            "edge_type": item["edge_type"],
            "confidence": item["confidence"],
            "cross_application": source["app"] != item["app"],
            "branches": [item["branch"]] if item["branch"] else [],
            "callsites": [item["callsite"]] if item["callsite"] else [],
            "evidence": item["evidence"],
        }
        if key not in session["edges"]:
            added_edges += 1
        merge_edge(session, edge)

        if item["confidence"] != "confirmed":
            target["state"][direction] = "unresolved"
            remove_frontier(session, direction, item["id"])
            created_blocks.append(
                add_block_record(
                    session,
                    item["id"],
                    direction,
                    item["question"],
                    item["candidates"],
                    f"{item['confidence']} edge from expansion of {node_id}",
                    key,
                )
            )
        elif item["terminal_reason"]:
            target["state"][direction] = "terminal"
            target["terminal"][direction] = {
                "reason": item["terminal_reason"],
                "evidence": item["evidence"],
            }
            remove_frontier(session, direction, item["id"])
        elif item["enqueue"] and target["state"][direction] == "unseen":
            target["state"][direction] = "pending"
            enqueue(session, direction, item["id"])

    if complete:
        source["state"][direction] = "expanded"
        source["continuation"][direction] = None
        remove_frontier(session, direction, node_id)
    else:
        source["state"][direction] = "in_progress"
        source["continuation"][direction] = str(continuation)
        enqueue(session, direction, node_id)
    save_session(session_path, session)
    print(
        json.dumps(
            {
                "node_id": node_id,
                "direction": direction,
                "state": source["state"][direction],
                "added_nodes": added_nodes,
                "added_edges": added_edges,
                "created_blocks": created_blocks,
            },
            ensure_ascii=False,
        )
    )


def terminal(args: argparse.Namespace) -> None:
    """`terminal` 子命令：把某节点在某方向标记为已核实的边界。

    将该方向状态置为 terminal 并从 frontier 出队，记录 terminal 原因，
    表示已确认该方向无需继续向外扩展。
    """
    session_path = Path(args.session)
    session = load_session(session_path)
    node = session["nodes"].get(args.node)
    if node is None:
        raise SessionError(f"node does not exist: {args.node}")
    if node["state"][args.direction] == "unseen":
        raise SessionError(f"node has not been reached in {args.direction}: {args.node}")
    if args.direction == "upstream" and args.evidence_kind != "user_confirmation":
        raise SessionError("every upstream terminal requires evidence-kind=user_confirmation")
    evidence = [{"kind": args.evidence_kind, "detail": args.evidence_detail}]
    node["state"][args.direction] = "terminal"
    node["continuation"][args.direction] = None
    node["terminal"][args.direction] = {"reason": args.reason, "evidence": evidence}
    remove_frontier(session, args.direction, args.node)
    save_session(session_path, session)
    print(json.dumps({"node_id": args.node, "direction": args.direction, "state": "terminal"}, ensure_ascii=False))


def block(args: argparse.Namespace) -> None:
    """`block` 子命令：记录一个待用户确认的疑问，并挂起对应节点方向。

    典型用于置信度不足、无法自动判定的调用关系；节点该方向状态置为 unresolved
    并从 frontier 出队，直到 confirm 解决对应 block。
    """
    session_path = Path(args.session)
    session = load_session(session_path)
    node = session["nodes"].get(args.node)
    if node is None:
        raise SessionError(f"node does not exist: {args.node}")
    if node["state"][args.direction] == "unseen":
        raise SessionError(f"node has not been reached in {args.direction}: {args.node}")
    candidates: Any = []
    if args.candidates:
        candidates = load_json(Path(args.candidates))
    node["state"][args.direction] = "unresolved"
    node["continuation"][args.direction] = None
    remove_frontier(session, args.direction, args.node)
    block_id = add_block_record(
        session, args.node, args.direction, args.question, candidates, args.reason
    )
    save_session(session_path, session)
    print(json.dumps({"block_id": block_id, "node_id": args.node, "direction": args.direction}, ensure_ascii=False))


def confirm(args: argparse.Namespace) -> None:
    """`confirm` 子命令：用用户的回答解决一个处于 open 的 block。

    根据 resolution（如确认存在/不存在/标记边界等）更新对应节点方向的状态，
    并将 block 置为 resolved，必要时重新入队或落定边界。
    """
    session_path = Path(args.session)
    session = load_session(session_path)
    record = next((item for item in session["blocks"] if item["id"] == args.block_id), None)
    if record is None:
        raise SessionError(f"block does not exist: {args.block_id}")
    if record["status"] != "open":
        raise SessionError(f"block is already {record['status']}: {args.block_id}")
    node = session["nodes"][record["node_id"]]
    direction = record["direction"]
    confirmation = {
        "block_id": args.block_id,
        "node_id": record["node_id"],
        "direction": direction,
        "resolution": args.resolution,
        "answer": args.answer,
        "confirmed_at": utc_now(),
    }
    related_edge_key = record.get("related_edge")
    if related_edge_key:
        edge = session["edges"].get(related_edge_key)
        if edge is None:
            raise SessionError(f"block references a missing edge: {related_edge_key}")
        user_evidence = {"kind": "user_confirmation", "detail": args.answer}
        if user_evidence not in edge["evidence"]:
            edge["evidence"].append(user_evidence)
        if edge["cross_application"] and not cross_app_evidence_is_complete(edge["evidence"]):
            raise SessionError(
                "user confirmation cannot complete this cross-application edge because contract or "
                "implementation evidence is still missing"
            )
        edge["confidence"] = "confirmed"
    session["confirmations"].append(confirmation)
    record["status"] = "resolved"
    record["resolution"] = confirmation
    if args.resolution == "resume":
        node["state"][direction] = "pending"
        enqueue(session, direction, node["id"])
    else:
        node["state"][direction] = "terminal"
        node["terminal"][direction] = {
            "reason": args.answer,
            "evidence": [{"kind": "user_confirmation", "detail": args.answer}],
        }
        remove_frontier(session, direction, node["id"])
    save_session(session_path, session)
    print(json.dumps(confirmation, ensure_ascii=False))


def set_budget(args: argparse.Namespace) -> None:
    """`set-budget` 子命令：提升会话的遍历预算。

    出于安全考虑，各项预算只能被增大，不能减小；否则视为无效请求。
    """
    session_path = Path(args.session)
    session = load_session(session_path)
    changes: dict[str, int] = {}
    for key in DEFAULT_CONFIG:
        value = getattr(args, key, None)
        if value is None:
            continue
        if value <= 0:
            raise SessionError(f"{key} must be positive")
        if value < session["config"][key]:
            raise SessionError(f"set-budget only increases budgets: {key} is currently {session['config'][key]}")
        session["config"][key] = value
        changes[key] = value
    if not changes:
        raise SessionError("provide at least one budget option")
    save_session(session_path, session)
    print(json.dumps({"updated": changes}, ensure_ascii=False))


def state_counts(session: dict[str, Any], direction: str) -> dict[str, int]:
    """统计所有节点在指定方向上各状态的数量分布。"""
    counts = {state: 0 for state in sorted(VALID_STATES)}
    for node in session["nodes"].values():
        counts[node["state"][direction]] += 1
    return counts


def validation_errors(session: dict[str, Any], require_complete: bool) -> list[str]:
    """扫描并返回一组结构性/一致性错误。

    校验入口节点存在、边的两端节点存在、frontier 中每个节点方向仍处于活跃状态。
    require_complete=True 时还额外要求：无 open 的 block、无 unresolved 的边、
    且各方向不存在 INCOMPLETE_STATES 的节点（即已彻底分析完成）。
    """
    errors: list[str] = []
    nodes = session.get("nodes", {})
    edges = session.get("edges", {})
    if session.get("entry_id") not in nodes:
        errors.append("entry_id does not reference an existing node")
    for app, record in session.get("applications", {}).items():
        path = record.get("project_path")
        if not path or not Path(path).is_absolute():
            errors.append(f"application {app} does not have an absolute project_path")
    for node_id, node in nodes.items():
        try:
            if canonical_id(node["app"], node["method"]) != node_id:
                errors.append(f"node key does not match canonical identity: {node_id}")
        except (KeyError, SessionError) as exc:
            errors.append(f"invalid node {node_id}: {exc}")
            continue
        for direction in DIRECTIONS:
            state = node.get("state", {}).get(direction)
            if state not in VALID_STATES:
                errors.append(f"node {node_id} has invalid {direction} state: {state}")
            if state == "terminal":
                terminal_record = node.get("terminal", {}).get(direction, {})
                terminal_evidence = terminal_record.get("evidence", [])
                if not terminal_record.get("reason") or not terminal_evidence:
                    errors.append(f"terminal node lacks reason/evidence in {direction}: {node_id}")
                if direction == "upstream" and not any(
                    item.get("kind") == "user_confirmation" for item in terminal_evidence
                ):
                    errors.append(f"upstream terminal lacks user confirmation: {node_id}")
            in_frontier = node_id in session.get("frontier", {}).get(direction, [])
            if state in ACTIVE_STATES and not in_frontier:
                errors.append(f"active node missing from {direction} frontier: {node_id}")
            if state not in ACTIVE_STATES and in_frontier:
                errors.append(f"inactive node present in {direction} frontier: {node_id}")
    for key, edge in edges.items():
        if edge.get("caller") not in nodes or edge.get("callee") not in nodes:
            errors.append(f"edge has missing endpoint: {key}")
        expected = edge_key(edge.get("caller", ""), edge.get("callee", ""), edge.get("edge_type", ""))
        if key != expected:
            errors.append(f"edge key mismatch: {key}")
        if not edge.get("evidence"):
            errors.append(f"edge has no evidence: {key}")
        if edge.get("cross_application") and edge.get("confidence") == "confirmed":
            if not cross_app_evidence_is_complete(edge.get("evidence", [])):
                errors.append(f"confirmed cross-application edge lacks evidence roles: {key}")
        if edge.get("confidence") != "confirmed" and require_complete:
            errors.append(f"non-confirmed edge remains: {key}")
    if require_complete:
        for direction in DIRECTIONS:
            for node_id, node in nodes.items():
                if node["state"][direction] in INCOMPLETE_STATES:
                    errors.append(
                        f"incomplete {direction} node {node_id}: {node['state'][direction]}"
                    )
        for record in session.get("blocks", []):
            if record.get("status") == "open":
                errors.append(f"open block remains: {record.get('id')}")
    return errors


def status_payload(session: dict[str, Any]) -> dict[str, Any]:
    """构造 status 命令输出的载荷：覆盖率、frontier、未决 blocks 等。"""
    open_blocks = [item for item in session["blocks"] if item["status"] == "open"]
    incomplete = False
    directions: dict[str, Any] = {}
    for direction in DIRECTIONS:
        counts = state_counts(session, direction)
        reached = sum(value for state, value in counts.items() if state != "unseen")
        complete_count = counts["expanded"] + counts["terminal"]
        incomplete = incomplete or any(counts[state] for state in INCOMPLETE_STATES)
        directions[direction] = {
            "counts": counts,
            "reached": reached,
            "settled": complete_count,
            "coverage_percent": round(100 * complete_count / reached, 2) if reached else 100.0,
            "frontier": session["frontier"][direction],
        }
    incomplete = incomplete or bool(open_blocks)
    incomplete = incomplete or any(
        edge.get("confidence") != "confirmed" for edge in session["edges"].values()
    )
    return {
        "complete": not incomplete,
        "entry_id": session["entry_id"],
        "applications": len(session["applications"]),
        "nodes": len(session["nodes"]),
        "edges": len(session["edges"]),
        "directions": directions,
        "open_blocks": open_blocks,
        "config": session["config"],
    }


def status(args: argparse.Namespace) -> None:
    """`status` 子命令：以 JSON 输出当前会话的进度摘要。"""
    session = load_session(Path(args.session))
    print(json.dumps(status_payload(session), ensure_ascii=False, indent=2))


def validate(args: argparse.Namespace) -> None:
    """`validate` 子命令：校验会话结构，可选强制要求分析完整性。"""
    session = load_session(Path(args.session))
    errors = validation_errors(session, args.require_complete)
    result = {
        "valid": not errors,
        "require_complete": args.require_complete,
        "status": status_payload(session),
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(2)


def md_escape(value: Any) -> str:
    """转义 Markdown 表格中的敏感字符：竖线转义、换行转 <br>。"""
    return str(value).replace("|", "\\|").replace("\n", "<br>")


def short_node(node_id: str, labels: dict[str, str], session: dict[str, Any]) -> str:
    """生成节点的简短展示标签，形如 `[N1] app::method`。"""
    node = session["nodes"][node_id]
    return f"[{labels[node_id]}] {node['app']}::{node['method']}"


def tree_lines(session: dict[str, Any], direction: str, labels: dict[str, str]) -> list[str]:
    """将某方向的调用关系渲染为带缩进的树状文本行列表。

    先按方向建立邻接表（downstream 用出边、upstream 用入边），
    再从入口节点做深度优先遍历，用缩进表达层级；遇到已访问节点标注 (cycle) 以避免环路无限展开。
    """
    outgoing: dict[str, list[dict[str, Any]]] = {node_id: [] for node_id in session["nodes"]}
    incoming: dict[str, list[dict[str, Any]]] = {node_id: [] for node_id in session["nodes"]}
    for edge in session["edges"].values():
        outgoing[edge["caller"]].append(edge)
        incoming[edge["callee"]].append(edge)
    for mapping in (outgoing, incoming):
        for values in mapping.values():
            values.sort(key=lambda edge: (edge["caller"], edge["callee"], edge["edge_type"]))
    lines = [short_node(session["entry_id"], labels, session)]
    expanded: set[str] = {session["entry_id"]}

    def walk(node_id: str, prefix: str) -> None:
        edges = outgoing[node_id] if direction == "downstream" else incoming[node_id]
        for index, edge in enumerate(edges):
            last = index == len(edges) - 1
            connector = "\u2514\u2500" if last else "\u251c\u2500"
            continuation = "  " if last else "\u2502 "
            target_id = edge["callee"] if direction == "downstream" else edge["caller"]
            branch = f" branch={'; '.join(edge['branches'])}" if edge["branches"] else ""
            if direction == "downstream":
                relation = f"--{edge['edge_type']}/{edge['confidence']}-->"
            else:
                relation = f"--{edge['edge_type']}/{edge['confidence']}--> {short_node(node_id, labels, session)} from"
            if direction == "upstream":
                description = f"{short_node(target_id, labels, session)} {relation}{branch}"
            else:
                description = f"{relation} {short_node(target_id, labels, session)}{branch}"
            if target_id in expanded:
                description += " \u21a9 shared/cycle"
                lines.append(prefix + connector + description)
                continue
            lines.append(prefix + connector + description)
            expanded.add(target_id)
            walk(target_id, prefix + continuation)

    walk(session["entry_id"], "")
    return lines


def strongly_connected_components(session: dict[str, Any]) -> list[list[str]]:
    """基于 Tarjan 算法计算图中「大小 > 1 或含自环」的强连通分量。

    用于在渲染时向用户展示潜在的循环调用；实现上采用迭代式栈避免深图递归栈溢出。
    """
    adjacency: dict[str, list[str]] = {node_id: [] for node_id in session["nodes"]}
    self_loops: set[str] = set()
    for edge in session["edges"].values():
        adjacency[edge["caller"]].append(edge["callee"])
        if edge["caller"] == edge["callee"]:
            self_loops.add(edge["caller"])
    index = 0
    stack: list[str] = []
    on_stack: set[str] = set()
    indices: dict[str, int] = {}
    lowlink: dict[str, int] = {}
    result: list[list[str]] = []

    def connect(node_id: str) -> None:
        nonlocal index
        indices[node_id] = index
        lowlink[node_id] = index
        index += 1
        stack.append(node_id)
        on_stack.add(node_id)
        for target in adjacency[node_id]:
            if target not in indices:
                connect(target)
                lowlink[node_id] = min(lowlink[node_id], lowlink[target])
            elif target in on_stack:
                lowlink[node_id] = min(lowlink[node_id], indices[target])
        if lowlink[node_id] == indices[node_id]:
            component: list[str] = []
            while True:
                target = stack.pop()
                on_stack.remove(target)
                component.append(target)
                if target == node_id:
                    break
            if len(component) > 1 or node_id in self_loops:
                result.append(sorted(component))

    for node_id in adjacency:
        if node_id not in indices:
            connect(node_id)
    return result


def render_markdown(session: dict[str, Any]) -> str:
    """把整个会话渲染为便于 AI/人类阅读的 Markdown 事实清单。

    输出包含：入口信息、状态摘要、节点/边/blocks/未确认部分表格、
    上下游调用树以及循环调用组，为下游模型提供结构化上下文。
    """
    labels = {node_id: f"N{index:04d}" for index, node_id in enumerate(session["nodes"], 1)}
    status_info = status_payload(session)
    errors = validation_errors(session, False)
    lines: list[str] = [
        f"# {session['entry_id']} \u8de8\u5e94\u7528\u53cc\u5411\u4ee3\u7801\u94fe\u8def",
        "",
        "## 1. \u5206\u6790\u5143\u6570\u636e",
        "",
        f"- \u5165\u53e3\uff1a`{session['entry_id']}`",
        f"- \u4f1a\u8bdd\u521b\u5efa\u65f6\u95f4\uff1a`{session['created_at']}`",
        f"- \u6700\u540e\u66f4\u65b0\uff1a`{session['updated_at']}`",
        f"- \u5b8c\u6574\u6027\uff1a**{'COMPLETE' if status_info['complete'] and not errors else 'INCOMPLETE'}**",
        f"- \u89c4\u6a21\uff1a{len(session['applications'])} applications / {len(session['nodes'])} nodes / {len(session['edges'])} edges",
        f"- \u5de5\u4f5c\u533a\uff1a{', '.join(session.get('workspace_roots', [])) or '(not recorded)'}",
        "- \u8303\u56f4\uff1a\u5df2\u767b\u8bb0\u9879\u76ee\u81ea\u6709\u4ee3\u7801\u4e0e\u53ef\u89e3\u6790\u8de8\u5e94\u7528\u8fb9\uff1b\u7b2c\u4e09\u65b9\u5e93\u53ca\u65e0\u6e90\u7801\u7cfb\u7edf\u4e3a\u8fb9\u754c\u3002",
        "",
        "## 2. \u8986\u76d6\u7387",
        "",
        "| \u65b9\u5411 | reached | expanded | terminal | pending | in_progress | unresolved | deferred | settled |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for direction in DIRECTIONS:
        info = status_info["directions"][direction]
        counts = info["counts"]
        lines.append(
            f"| {direction} | {info['reached']} | {counts['expanded']} | {counts['terminal']} | "
            f"{counts['pending']} | {counts['in_progress']} | {counts['unresolved']} | "
            f"{counts['deferred']} | {info['coverage_percent']}% |"
        )
    lines.extend(["", "## 3. \u5e94\u7528\u5730\u56fe", "", "| Application | Project path | CodeGraph |", "|---|---|---|"])
    for app, record in session["applications"].items():
        lines.append(
            f"| {md_escape(app)} | `{md_escape(record['project_path'])}` | "
            f"{'yes' if record.get('codegraph_indexed') else 'no'} |"
        )
    lines.extend(["", "## 4. \u4e0a\u6e38\u8c03\u7528\u56fe", "", "```text"])
    lines.extend(tree_lines(session, "upstream", labels))
    lines.extend(["```", "", "## 5. \u4e0b\u6e38\u8c03\u7528\u56fe", "", "```text"])
    lines.extend(tree_lines(session, "downstream", labels))
    lines.extend(["```", "", "## 6. \u8de8\u5e94\u7528\u8fb9", "", "| Caller | Type | Callee | Confidence | Evidence |", "|---|---|---|---|---|"])
    cross_edges = [edge for edge in session["edges"].values() if edge["cross_application"]]
    if not cross_edges:
        lines.append("| - | - | - | - | \u65e0 |")
    for edge in cross_edges:
        evidence = "; ".join(f"{item['kind']}: {item['detail']}" for item in edge["evidence"])
        lines.append(
            f"| {md_escape(short_node(edge['caller'], labels, session))} | {md_escape(edge['edge_type'])} | "
            f"{md_escape(short_node(edge['callee'], labels, session))} | {edge['confidence']} | {md_escape(evidence)} |"
        )
    lines.extend(["", "## 7. \u5faa\u73af\u4e0e\u9012\u5f52", ""])
    components = strongly_connected_components(session)
    if not components:
        lines.append("\u672a\u53d1\u73b0\u6709\u5411\u73af\u3002")
    else:
        for index, component in enumerate(components, 1):
            lines.append(f"- SCC-{index}: " + ", ".join(short_node(item, labels, session) for item in component))
    lines.extend(["", "## 8. \u672a\u51b3\u9879\u4e0e\u7528\u6237\u786e\u8ba4", ""])
    open_blocks = [item for item in session["blocks"] if item["status"] == "open"]
    if not open_blocks:
        lines.append("\u65e0\u5f00\u653e\u672a\u51b3\u9879\u3002")
    for item in open_blocks:
        lines.append(
            f"- **{item['id']}** {short_node(item['node_id'], labels, session)} / {item['direction']}: "
            f"{item['question']} (reason: {item['reason']})"
        )
    if session["confirmations"]:
        lines.extend(["", "\u5df2\u786e\u8ba4\uff1a"])
        for item in session["confirmations"]:
            lines.append(
                f"- {item['block_id']} / {item['resolution']} / {item['answer']} / {item['confirmed_at']}"
            )
    lines.extend(["", "## 9. \u8282\u70b9\u76ee\u5f55", "", "| ID | Application | Method | Kind | Upstream | Downstream | Source |", "|---|---|---|---|---|---|---|"])
    for node_id, node in session["nodes"].items():
        source = ""
        if node["source"]:
            source = f"{node['source'].get('file', '')}:{node['source'].get('line', '')}"
        lines.append(
            f"| {labels[node_id]} | {md_escape(node['app'])} | `{md_escape(node['method'])}` | "
            f"{md_escape(node['kind'])} | {node['state']['upstream']} | {node['state']['downstream']} | {md_escape(source)} |"
        )
    lines.extend(["", "## 10. \u8fb9\u4e0e\u8bc1\u636e\u9644\u5f55", "", "| Caller | Callee | Type | Branch / callsite | Confidence | Evidence |", "|---|---|---|---|---|---|"])
    for edge in session["edges"].values():
        locations = []
        for callsite in edge["callsites"]:
            locations.append(f"{callsite.get('file', '')}:{callsite.get('line', '')}")
        context = "; ".join(edge["branches"] + locations)
        evidence = "; ".join(f"{item['kind']}: {item['detail']}" for item in edge["evidence"])
        lines.append(
            f"| {md_escape(short_node(edge['caller'], labels, session))} | "
            f"{md_escape(short_node(edge['callee'], labels, session))} | {md_escape(edge['edge_type'])} | "
            f"{md_escape(context)} | {edge['confidence']} | {md_escape(evidence)} |"
        )
    if errors:
        lines.extend(["", "## 11. \u7ed3\u6784\u6821\u9a8c\u9519\u8bef", ""])
        lines.extend(f"- {error}" for error in errors)
    lines.append("")
    return "\n".join(lines)


def render(args: argparse.Namespace) -> None:
    """`render` 子命令：将会话渲染为 Markdown 并写入 --output 指定文件。"""
    session = load_session(Path(args.session))
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    content = render_markdown(session)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{output.name}.", dir=output.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, output)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
    print(json.dumps({"output": str(output), "complete": status_payload(session)["complete"]}, ensure_ascii=False))


def positive_integer(value: str) -> int:
    """argparse 类型校验器：把字符串转为正整数，非正数则报错。"""
    result = int(value)
    if result <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return result


def add_budget_arguments(parser: argparse.ArgumentParser) -> None:
    """为子命令批量注册各项预算参数（由 DEFAULT_CONFIG 的键派生）。"""
    for key in DEFAULT_CONFIG:
        parser.add_argument(f"--{key.replace('_', '-')}", dest=key, type=positive_integer)


def build_parser() -> argparse.ArgumentParser:
    """构建顶层命令行解析器，注册全部子命令及其参数。"""
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="create a new analysis session")
    init_parser.add_argument("session")
    init_parser.add_argument("--app", required=True)
    init_parser.add_argument("--project", required=True)
    init_parser.add_argument("--method", required=True)
    init_parser.add_argument("--source-file")
    init_parser.add_argument("--line", type=positive_integer)
    init_parser.add_argument("--workspace-root", action="append", default=[])
    init_parser.add_argument("--force", action="store_true")
    add_budget_arguments(init_parser)
    init_parser.set_defaults(handler=init_session)

    next_parser = subparsers.add_parser("next", help="show the next one-hop task")
    next_parser.add_argument("session")
    next_parser.add_argument("--direction", choices=("both",) + DIRECTIONS, default="both")
    next_parser.set_defaults(handler=next_node)

    expand_parser = subparsers.add_parser("expand", help="atomically apply one-hop findings")
    expand_parser.add_argument("session")
    expand_parser.add_argument("--input", required=True)
    expand_parser.set_defaults(handler=expand)

    terminal_parser = subparsers.add_parser("terminal", help="mark a reached node as a verified boundary")
    terminal_parser.add_argument("session")
    terminal_parser.add_argument("--node", required=True)
    terminal_parser.add_argument("--direction", choices=DIRECTIONS, required=True)
    terminal_parser.add_argument("--reason", required=True)
    terminal_parser.add_argument("--evidence-kind", required=True)
    terminal_parser.add_argument("--evidence-detail", required=True)
    terminal_parser.set_defaults(handler=terminal)

    block_parser = subparsers.add_parser("block", help="record a question that requires user confirmation")
    block_parser.add_argument("session")
    block_parser.add_argument("--node", required=True)
    block_parser.add_argument("--direction", choices=DIRECTIONS, required=True)
    block_parser.add_argument("--reason", required=True)
    block_parser.add_argument("--question", required=True)
    block_parser.add_argument("--candidates", help="JSON file containing candidate targets")
    block_parser.set_defaults(handler=block)

    confirm_parser = subparsers.add_parser("confirm", help="resolve an open block with the user's answer")
    confirm_parser.add_argument("session")
    confirm_parser.add_argument("--block-id", required=True)
    confirm_parser.add_argument("--resolution", choices=("resume", "terminal"), required=True)
    confirm_parser.add_argument("--answer", required=True)
    confirm_parser.set_defaults(handler=confirm)

    budget_parser = subparsers.add_parser("set-budget", help="increase one or more traversal budgets")
    budget_parser.add_argument("session")
    add_budget_arguments(budget_parser)
    budget_parser.set_defaults(handler=set_budget)

    status_parser = subparsers.add_parser("status", help="show coverage, frontier, and blocks")
    status_parser.add_argument("session")
    status_parser.set_defaults(handler=status)

    validate_parser = subparsers.add_parser("validate", help="validate graph and optional completeness")
    validate_parser.add_argument("session")
    validate_parser.add_argument("--require-complete", action="store_true")
    validate_parser.set_defaults(handler=validate)

    render_parser = subparsers.add_parser("render", help="render an AI-readable Markdown fact sheet")
    render_parser.add_argument("session")
    render_parser.add_argument("--output", required=True)
    render_parser.set_defaults(handler=render)
    return parser


def main() -> None:
    """程序入口：解析参数、调度到对应 handler，并将异常转为规范的退出码。

    退出码约定：
    - 0：成功；
    - 2：会话或输入错误（SessionError）——用户可纠正；
    - 3：违反遍历预算（BudgetError）——需 set-budget 后重试。
    """
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.handler(args)
    except BudgetError as exc:
        print(json.dumps({"error": "budget_exceeded", "detail": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(3) from exc
    except SessionError as exc:
        print(json.dumps({"error": "invalid_session_or_input", "detail": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from exc


if __name__ == "__main__":
    main()
