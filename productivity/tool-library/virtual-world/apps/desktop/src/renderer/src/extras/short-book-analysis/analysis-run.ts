import { computed, ref, shallowRef } from "vue";
import { createId } from "@deepwrite/shared";
import {
  assertShortAnalysisBudget,
  ShortBookAnalysisRuntimeContextSchema,
  type DeepWriteApi,
  type ModelConfig,
  type ShortBookAnalysisPreset,
  type ShortBookAnalysisResult,
  type ShortBookAnalysisSource,
  type SystemEventEnvelope,
  type ThinkingLevel
} from "@deepwrite/contracts/renderer";
import type { LongBookAnalysisProcessEntry } from "../long-book-analysis/analysis-process";
interface Job {
  context: ReturnType<typeof ShortBookAnalysisRuntimeContextSchema.parse>;
  preset: ShortBookAnalysisPreset;
  model: ModelConfig;
  thinkingLevel: ThinkingLevel;
  libraryId: string;
}
export function createShortAnalysisRun(api: () => DeepWriteApi) {
  const status = ref<
    "idle" | "running" | "stopping" | "stopped" | "error" | "completed"
  >("idle");
  const result = ref<ShortBookAnalysisResult | null>(null);
  const preset = shallowRef<ShortBookAnalysisPreset | null>(null);
  const targetLibraryId = ref("");
  const error = ref<string | null>(null);
  const liveOutput = ref("");
  const activity = ref("等待开始");
  const entries = ref<LongBookAnalysisProcessEntry[]>([]);
  const isBusy = computed(
    () => status.value === "running" || status.value === "stopping"
  );
  let job: Job | null = null;
  let pending: {
    sessionId: string;
    runId?: string;
    result?: ShortBookAnalysisResult;
  } | null = null;
  let disposed = false;
  const stopping = () => status.value === "stopping";
  const canRetry = computed(
    () => status.value === "stopped" || status.value === "error"
  );
  function log(
    message: string,
    detail?: string,
    tone: LongBookAnalysisProcessEntry["tone"] = "info"
  ) {
    activity.value = message;
    entries.value = [
      ...entries.value,
      {
        id: createId("short_analysis_process"),
        createdAt: new Date().toISOString(),
        title: message,
        ...(detail ? { detail } : {}),
        tone,
        phase: null
      }
    ];
    if (entries.value.length > 120)
      entries.value.splice(1, entries.value.length - 120);
  }
  function setActivity(message: string) {
    if (activity.value !== message) log(message);
  }
  function clear() {
    if (isBusy.value) throw new Error("分析运行中，不能修改输入。");
    job = null;
    result.value = null;
    preset.value = null;
    status.value = "idle";
    error.value = null;
    entries.value = [];
    liveOutput.value = "";
    activity.value = "等待开始";
  }
  function fail(cause: unknown) {
    status.value = "error";
    error.value = cause instanceof Error ? cause.message : "短篇拆书失败。";
    log(error.value, undefined, "error");
    pending = null;
  }
  async function execute() {
    if (!job || disposed) return;
    const current = job;
    assertShortAnalysisBudget(current.context, current.preset, current.model);
    status.value = "running";
    error.value = null;
    result.value = null;
    liveOutput.value = "";
    entries.value = [];
    log(
      `正在联合分析 ${current.context.books.length} 本短篇`,
      `预设：${current.preset.name} · ${current.context.books.map((book) => book.title).join("、")} · 共 ${current.context.books.reduce((total, book) => total + book.text.length, 0).toLocaleString()} 字符`
    );
    log("正在提交分析请求");
    const unit: {
      sessionId: string;
      runId?: string;
      result?: ShortBookAnalysisResult;
    } = { sessionId: createId("short_analysis_session") };
    pending = unit;
    try {
      const accepted = await api().session.prompt({
        sessionId: unit.sessionId,
        message: "基于全部所选短篇全文，按预设生成一份完整综合分析。",
        modelId: current.model.id,
        thinkingLevel: current.thinkingLevel,
        writeApprovalMode: "request-approval",
        workspaceContext: { shortBookAnalysis: current.context }
      });
      if (pending !== unit) {
        if (disposed)
          await api().session.abort({
            sessionId: unit.sessionId,
            runId: accepted.runId
          });
        return;
      }
      unit.runId = accepted.runId;
      if (activity.value === "正在提交分析请求")
        log("请求已接收，等待模型响应");
      if (stopping()) await abortPending();
    } catch (cause) {
      if (pending === unit && !disposed) {
        if (stopping()) {
          pending = null;
          status.value = "stopped";
          log("已停止，可重新分析");
        } else fail(cause);
      }
    }
  }
  async function abortPending() {
    const unit = pending;
    if (!unit?.runId) return;
    try {
      await api().session.abort({
        sessionId: unit.sessionId,
        runId: unit.runId
      });
      if (pending === unit) {
        pending = null;
        status.value = "stopped";
        log("已停止，可重新分析");
      }
    } catch (cause) {
      if (pending === unit) {
        status.value = "running";
        error.value =
          cause instanceof Error ? cause.message : "停止失败，请重试。";
        log(error.value, undefined, "error");
      }
    }
  }
  function start(
    books: ShortBookAnalysisSource[],
    selectedPreset: ShortBookAnalysisPreset,
    model: ModelConfig,
    thinkingLevel: ThinkingLevel,
    libraryId: string
  ) {
    if (isBusy.value) throw new Error("分析正在运行。");
    if (
      thinkingLevel !== "off" &&
      !model.thinkingLevelOptions.includes(thinkingLevel)
    )
      throw new Error("请选择当前模型支持的思考等级。");
    const context = ShortBookAnalysisRuntimeContextSchema.parse({
      jobId: createId("short_analysis_job"),
      presetId: selectedPreset.id,
      books
    });
    assertShortAnalysisBudget(context, selectedPreset, model);
    const snapshot = JSON.parse(
      JSON.stringify({
        context,
        preset: selectedPreset,
        model,
        thinkingLevel,
        libraryId
      })
    ) as Job;
    job = snapshot;
    preset.value = snapshot.preset;
    targetLibraryId.value = libraryId;
    void execute();
  }
  function handleEvent(event: SystemEventEnvelope) {
    const unit = pending;
    if (!unit || disposed) return;
    if (
      (event.type === "system.worker_restarting" ||
        event.type === "system.worker_restarted") &&
      event.payload.worker === "agent"
    ) {
      fail(new Error("分析进程已重启，请重新分析。"));
      return;
    }
    if (
      !("sessionId" in event.payload) ||
      event.payload.sessionId !== unit.sessionId
    )
      return;
    if ("runId" in event.payload) {
      if (unit.runId && event.payload.runId !== unit.runId) return;
      unit.runId = event.payload.runId;
    }
    if (stopping()) {
      if (
        event.type === "agent.message_completed" ||
        event.type === "agent.error"
      ) {
        pending = null;
        status.value = "stopped";
        log("已停止，可重新分析");
      }
      return;
    }
    if (event.type === "agent.message_delta") {
      setActivity("模型正在输出分析说明");
      liveOutput.value = (liveOutput.value + event.payload.delta).slice(
        -200000
      );
    } else if (event.type === "agent.thinking_delta")
      setActivity("模型正在分析全文");
    else if (event.type === "tool.call_requested") log("正在生成结构化结果");
    else if (
      event.type === "short_book_analysis.result_updated" &&
      event.payload.jobId === job?.context.jobId
    ) {
      unit.result = event.payload.result;
      log("结构化结果已生成", event.payload.result.name, "success");
    } else if (
      event.type === "tool.execution_completed" &&
      event.payload.isError
    )
      log("生成结果时遇到错误", "等待模型修正或重试当前动作", "error");
    else if (event.type === "agent.error")
      fail(new Error(event.payload.message));
    else if (event.type === "agent.message_completed") {
      if (!liveOutput.value.trim() && event.payload.content?.trim())
        liveOutput.value = event.payload.content.slice(-200000);
      if (!unit.result) {
        fail(new Error("模型未提交结构化结果，请重新分析。"));
        return;
      }
      result.value = unit.result;
      pending = null;
      status.value = "completed";
      log("分析完成，结果可编辑并保存", undefined, "success");
    }
  }
  return {
    status,
    result,
    preset,
    targetLibraryId,
    error,
    liveOutput,
    activity,
    entries,
    isBusy,
    canRetry,
    clear,
    start,
    handleEvent,
    retry() {
      if (canRetry.value && !isBusy.value) void execute();
    },
    async stop() {
      if (!isBusy.value) return;
      status.value = "stopping";
      log("正在停止");
      await abortPending();
    },
    dispose() {
      disposed = true;
      const unit = pending;
      pending = null;
      if (unit?.runId)
        void api()
          .session.abort({ sessionId: unit.sessionId, runId: unit.runId })
          .catch(() => undefined);
    }
  };
}
