<script setup lang="ts">
import type { LongBookAnalysisController } from "./useLongBookAnalysis";

defineProps<{
  controller: LongBookAnalysisController;
  selectionCount: number;
  presetName: string;
  canStart: boolean;
}>();
defineEmits<{ start: []; showResult: [] }>();
</script>

<template>
  <div class="analysis-run-bar">
    <div class="analysis-run-progress">
      <strong>已选 {{ selectionCount }} 章</strong>
      <span>{{ controller.progressText.value }}</span>
    </div>
    <div class="analysis-run-actions">
      <button
        v-if="controller.result.value"
        type="button"
        @click="$emit('showResult')"
      >
        查看生成结果
      </button>
      <button
        v-if="controller.canRetry.value"
        type="button"
        @click="controller.retry"
      >
        从失败阶段继续
      </button>
      <button
        v-if="controller.isBusy.value"
        type="button"
        :disabled="controller.status.value === 'stopping'"
        @click="controller.stop"
      >
        停止
      </button>
      <button
        v-else
        class="analysis-primary-button"
        type="button"
        :disabled="!canStart"
        @click="$emit('start')"
      >
        执行“{{ presetName }}”预设
      </button>
    </div>
  </div>
</template>
