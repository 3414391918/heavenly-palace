import { computed, ref } from "vue";
import { createId } from "@deepwrite/shared";
import {
  assertRevisionAnalysisBudget,
  RevisionAnalysisRuntimeContextSchema,
  type DeepWriteApi,
  type ModelConfig,
  type RevisionAnalysisResult,
  type RevisionAnalysisInput,
  type SystemEventEnvelope,
  type ThinkingLevel
} from "@deepwrite/contracts/renderer";
interface Job {
  context: ReturnType<typeof RevisionAnalysisRuntimeContextSchema.parse>;
  model: ModelConfig;
  thinkingLevel: ThinkingLevel;
}
export function createRevisionAnalysisRun(api: () => DeepWriteApi) {
  const status = ref<
    "idle" | "running" | "stopping" | "stopped" | "error" | "completed"
  >("idle");
  const completedInput = ref("");
  const result = ref<RevisionAnalysisResult | null>(null);
  const error = ref<string | null>(null);
  const liveOutput = ref("");
  const activity = ref("等待开始");
  const entries = ref<string[]>([]);
  const isBusy = computed(
    () => status.value === "running" || status.value === "stopping"
  );
  let job: Job | null = null;
  let pending: {
    sessionId: string;
    runId?: string;
    result?: RevisionAnalysisResult;
  } | null = null;
  let disposed = false;
  const stopping = () => status.value === "stopping";
  const canRetry = computed(
    () => status.value === "stopped" || status.value === "error"
  );
  function log(message: string) {
    activity.value = message;
    entries.value.push(message);
  }
  function clear() {
    if (isBusy.value) throw new Error("分析运行中，不能修改输入。");
    job = null;
    result.value = null;
    status.value = "idle";
    error.value = null;
    entries.value = [];
    liveOutput.value = "";
    activity.value = "等待开始";
  }
  function fail(cause: unknown) {
    status.value = "error";
    error.value = cause instanceof Error ? cause.message : "修改分析失败。";
    log(error.value);
    pending = null;
  }
  async function execute() {
    if (!job || disposed) return;
    const current = job;
    assertRevisionAnalysisBudget(current.context, current.model);
    status.value = "running";
    error.value = null;
    liveOutput.value = "";
    entries.value = [];
    log(`正在学习 ${current.context.changes.length} 组修改`);
    const unit: {
      sessionId: string;
      runId?: string;
      result?: RevisionAnalysisResult;
    } = { sessionId: createId("revision_analysis_session") };
    pending = unit;
    try {
      const accepted = await api().session.prompt({
        sessionId: unit.sessionId,
        message: "学习完整前后正文与差异，同时生成分析报告及可复用技能。",
        modelId: current.model.id,
        thinkingLevel: current.thinkingLevel,
        writeApprovalMode: "request-approval",
        workspaceContext: { revisionAnalysis: current.context }
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
        log(error.value);
      }
    }
  }
  function start(
    input: RevisionAnalysisInput,
    model: ModelConfig,
    thinkingLevel: ThinkingLevel
  ) {
    if (isBusy.value || disposed) throw new Error("分析正在运行或已释放。");
    if (
      thinkingLevel !== "off" &&
      !model.thinkingLevelOptions.includes(thinkingLevel)
    )
      throw new Error("请选择当前模型支持的思考等级。");
    const context = RevisionAnalysisRuntimeContextSchema.parse({
      ...input,
      jobId: createId("revision_analysis_job")
    });
    assertRevisionAnalysisBudget(context, model);
    job = JSON.parse(JSON.stringify({ context, model, thinkingLevel })) as Job;
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
    if (event.type === "agent.message_delta")
      liveOutput.value = (liveOutput.value + event.payload.delta).slice(
        -200000
      );
    else if (event.type === "agent.thinking_delta")
      activity.value = "模型正在思考";
    else if (event.type === "tool.call_requested") log("正在新建技能草稿");
    else if (
      event.type === "revision_analysis.result_updated" &&
      event.payload.jobId === job?.context.jobId
    )
      unit.result = {
        ...event.payload.result,
        report: event.payload.result.report || liveOutput.value.trim()
      };
    else if (event.type === "agent.error")
      fail(new Error(event.payload.message));
    else if (event.type === "agent.message_completed") {
      if (!unit.result) {
        fail(new Error("模型未调用工具新建技能草稿，请重试上次任务。"));
        return;
      }
      result.value = {
        ...unit.result,
        report:
          unit.result.report ||
          (event.payload.content || liveOutput.value).trim().slice(0, 200000)
      };
      if (job) {
        const { jobId, ...input } = job.context;
        void jobId;
        completedInput.value = JSON.stringify(input);
      }
      pending = null;
      status.value = "completed";
      log("分析完成，结果可编辑并保存");
    }
  }
  return {
    completedInput,
    status,
    result,
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
