<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type {
  SyncInitializationPreview,
  SyncRequest,
  SyncResponse,
  SyncStatus
} from "@deepwrite/contracts/renderer";
import PopupSelect from "../../components/PopupSelect.vue";

const props = defineProps<{
  status: SyncStatus;
  pending: boolean;
  request(input: SyncRequest): Promise<SyncResponse | null>;
}>();
const sources = computed(() =>
  props.status.devices.filter((device) => device.id !== props.status.deviceId)
);
const selected = ref("");
const source = computed(
  () =>
    sources.value.find((device) => device.id === selected.value) ??
    sources.value[0]
);
const choices = computed(() =>
  sources.value.map((device) => ({ value: device.id, label: device.name }))
);
const preview = ref<SyncInitializationPreview | null>(null);
const dialog = ref<HTMLDialogElement | null>(null);
let disposed = false;
watch([() => source.value?.id, () => props.status.config?.spaceId], () => {
  preview.value = null;
  dialog.value?.close();
});
onBeforeUnmount(() => {
  disposed = true;
  dialog.value?.close();
});

async function download() {
  if (!source.value || props.pending) return;
  preview.value = null;
  const deviceId = source.value.id;
  const result = await props.request({
    operation: "preview-initialization",
    deviceId
  });
  if (
    !disposed &&
    source.value?.id === deviceId &&
    result?.kind === "initialization-preview"
  )
    preview.value = result.preview;
}
function confirm() {
  if (preview.value && !props.pending) dialog.value?.showModal();
}
async function initialize() {
  if (!preview.value || props.pending) return;
  const token = preview.value.token;
  dialog.value?.close();
  preview.value = null;
  await props.request({ operation: "initialize", token });
}
</script>

<template>
  <section class="sync-card" aria-label="从远端初始化">
    <h2>用远端数据初始化本机</h2>
    <p>
      适用于手机里能打开作品，但本机目录失效、结构不兼容或普通下载无法完成的情况。
    </p>
    <p>
      先在手机或另一台电脑上传全部作品和资料，再选择该设备。下载并校验完成后，才会要求确认替换。
    </p>
    <p>
      本机全部作品和资料列表（包括暂停同步及本机独有的项目）与同步历史将被替换。旧作品目录和恢复信息保留；网盘连接、模型配置和密钥保留。
    </p>
    <label class="sync-initialization-source">
      <span>来源设备</span>
      <PopupSelect
        :model-value="source?.id ?? ''"
        :options="choices"
        accessible-label="初始化来源设备"
        :disabled="pending || !sources.length"
        placeholder="尚未发现其他设备"
        @update:model-value="selected = String($event)"
      />
    </label>
    <p v-if="source">
      最后上传：{{ new Date(source.updatedAt).toLocaleString() }}
    </p>
    <p v-else>
      尚未发现其他设备上传的数据。请先在手机上传，再点击“检查远端更新”。
    </p>
    <div class="sync-actions">
      <button
        class="sync-button secondary"
        :disabled="pending"
        @click="request({ operation: 'check' })"
      >
        检查远端更新
      </button>
      <button
        class="sync-button"
        :disabled="pending || !source"
        @click="download"
      >
        {{ preview ? "重新下载预览" : "下载并预览远端数据" }}
      </button>
    </div>
    <section
      v-if="preview"
      class="sync-initialization-preview"
      aria-live="polite"
    >
      <h3>远端数据已校验</h3>
      <p>
        来源：{{ preview.deviceName }} ·
        {{ new Date(preview.remoteUpdatedAt).toLocaleString() }}
      </p>
      <p>
        替换本机 {{ preview.localItemCount }} 项作品和资料，导入远端
        {{ preview.itemCount }} 项、{{ preview.fileCount }} 个文件。
      </p>
      <p>
        仅采用该设备已上传的版本；聊天记录不从远端导入。本机或远端发生新修改后，需要重新预览。
      </p>
      <button class="sync-button" :disabled="pending" @click="confirm">
        用此版本初始化本机
      </button>
    </section>
    <dialog
      ref="dialog"
      class="sync-card sync-initialization-dialog"
      aria-labelledby="sync-initialization-title"
    >
      <h2 id="sync-initialization-title">替换本机作品和资料？</h2>
      <p>
        将本机全部作品和资料列表替换为“{{ preview?.deviceName }}”已上传的
        {{ preview?.itemCount }}
        项内容。本机独有内容和未上传修改不会并入新版本。
      </p>
      <p>
        旧作品目录和恢复信息保留，可重新打开原目录恢复。此操作不会删除远端数据。
      </p>
      <div class="sync-actions">
        <button
          class="sync-button secondary"
          autofocus
          @click="dialog?.close()"
        >
          取消
        </button>
        <button class="sync-button" :disabled="pending" @click="initialize">
          确认替换并初始化
        </button>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.sync-initialization-source {
  display: grid;
  gap: 8px;
}
.sync-initialization-preview {
  padding: 16px;
  border-radius: 8px;
  background: var(--surface-muted);
}
.sync-initialization-dialog {
  color: var(--text-primary);
  width: min(520px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  margin: auto;
  font: inherit;
}
.sync-initialization-dialog:not([open]) {
  display: none;
}
.sync-initialization-dialog::backdrop {
  background: color-mix(in srgb, var(--text-primary) 35%, transparent);
}
</style>
