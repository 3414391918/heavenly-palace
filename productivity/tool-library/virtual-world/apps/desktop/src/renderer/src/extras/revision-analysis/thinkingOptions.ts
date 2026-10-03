import type { ModelConfig } from "@deepwrite/contracts/renderer";
const THINKING_LABELS: Record<string, string> = {
  off: "关闭",
  minimal: "最低",
  low: "较低",
  medium: "标准",
  high: "深度",
  xhigh: "极高",
  max: "最高"
};
export function analysisThinkingOptions(model: ModelConfig | null) {
  return [
    { value: "off", label: THINKING_LABELS.off! },
    ...(model?.reasoning
      ? model.thinkingLevelOptions.map((value) => ({
          value,
          label: THINKING_LABELS[value] ?? value
        }))
      : [])
  ];
}
