<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref
} from "vue";
import type { UpdateState } from "@deepwrite/contracts";
import AppIcon from "./AppIcon.vue";
import { useAnnouncedVersion } from "../composables/useAnnouncedVersion";
import { AuthorSupportDialog } from "./lazyAppComponents";
import { uiMessage } from "../ui-feedback";
const VersionUpdateDialog = defineAsyncComponent(
  () => import("./VersionUpdateDialog.vue")
);
const props = defineProps<{ marketplaceDisplayName?: string | undefined }>();
const emit = defineEmits<{ openSettings: [] }>();

const DEFAULT_USER_NAME = "作者";

const accountMenuRoot = ref<HTMLElement | null>(null);
const accountMenuOpen = ref(false);
const profileDialog = ref<"contact" | "update" | "support" | null>(null);
const displayedUserName = computed(
  () => props.marketplaceDisplayName?.trim() || DEFAULT_USER_NAME
);
const avatarInitial = computed(
  () => Array.from(displayedUserName.value.trim())[0] ?? "作"
);
const updateState = ref<UpdateState>({
  status: "idle",
  currentVersion: "—",
  releaseNotes: [],
  mandatory: false,
  canDownload: false,
  canInstall: false
});
let unsubscribeUpdates: (() => void) | undefined;

const {
  announcedVersion,
  officialDocsUrl,
  hasVersionNotice,
  manualUpdateRequired,
  refreshAnnouncedVersion
} = useAnnouncedVersion(updateState);
const updateInstalling = computed(
  () => updateState.value.status === "installing"
);

function showUpdateError(state: UpdateState): void {
  if (state.status === "error") {
    uiMessage.error(state.message ?? "更新操作失败，请稍后重试");
  }
}

function toggleAccountMenu(): void {
  accountMenuOpen.value = !accountMenuOpen.value;
}

function openContactDialog(): void {
  accountMenuOpen.value = false;
  profileDialog.value = "contact";
}

function openSupportDialog(): void {
  accountMenuOpen.value = false;
  profileDialog.value = "support";
}

async function openUpdateDialog(): Promise<void> {
  void refreshAnnouncedVersion();
  accountMenuOpen.value = false;
  profileDialog.value = "update";
  if (!window.deepwrite?.updates) {
    updateState.value = {
      ...updateState.value,
      status: "unsupported",
      message: "当前环境不支持桌面端更新检查。"
    };
    return;
  }
  try {
    updateState.value = await window.deepwrite.updates.getState();
    if (
      !["downloading", "downloaded", "installing"].includes(
        updateState.value.status
      )
    ) {
      updateState.value = await window.deepwrite.updates.check();
    }
  } catch (error: unknown) {
    uiMessage.error(error instanceof Error ? error.message : "检查更新失败");
  }
}

async function checkUpdate(): Promise<void> {
  void refreshAnnouncedVersion();
  try {
    updateState.value = await window.deepwrite!.updates.check();
  } catch (error: unknown) {
    uiMessage.error(error instanceof Error ? error.message : "检查更新失败");
  }
}

async function downloadUpdate(): Promise<void> {
  if (manualUpdateRequired.value) return;
  try {
    updateState.value = await window.deepwrite!.updates.download();
  } catch (error: unknown) {
    uiMessage.error(error instanceof Error ? error.message : "下载更新失败");
  }
}

async function installUpdate(): Promise<void> {
  if (manualUpdateRequired.value) return;
  try {
    await window.deepwrite!.updates.install();
  } catch (error: unknown) {
    if (updateState.value.status !== "error") {
      uiMessage.error(
        error instanceof Error ? error.message : "启动更新安装失败"
      );
    }
  }
}

function closeProfileDialog(): void {
  if (profileDialog.value === "update" && updateInstalling.value) return;
  const restoreFocus = profileDialog.value === "support";
  profileDialog.value = null;
  if (restoreFocus) {
    void nextTick(() => {
      accountMenuRoot.value
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus();
    });
  }
}

function openSettings(): void {
  accountMenuOpen.value = false;
  emit("openSettings");
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (
    accountMenuOpen.value &&
    event.target instanceof Node &&
    !accountMenuRoot.value?.contains(event.target)
  ) {
    accountMenuOpen.value = false;
  }
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (profileDialog.value) {
    closeProfileDialog();
    return;
  }
  accountMenuOpen.value = false;
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeydown);
  unsubscribeUpdates = window.deepwrite?.updates?.subscribe((state) => {
    updateState.value = state;
    showUpdateError(state);
  });
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("keydown", handleDocumentKeydown);
  unsubscribeUpdates?.();
});
</script>

<template>
  <footer class="sidebar-footer">
    <div class="account-controls">
      <div ref="accountMenuRoot" class="account-profile">
        <button
          class="account-row account-identity-button"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="accountMenuOpen"
          aria-controls="account-menu"
          @click="toggleAccountMenu"
        >
          <span class="avatar account-avatar">
            {{ avatarInitial }}
            <span
              v-if="hasVersionNotice"
              class="version-notice-dot avatar-version-notice"
              role="img"
              aria-label="版本更新提醒"
            />
          </span>
          <span class="account-copy">
            <strong :title="displayedUserName">{{ displayedUserName }}</strong>
          </span>
        </button>

        <div
          v-if="accountMenuOpen"
          id="account-menu"
          class="account-menu"
          role="menu"
        >
          <button type="button" role="menuitem" @click="openSettings">
            <AppIcon name="settings" :size="16" />
            <span>设置</span>
          </button>
          <button type="button" role="menuitem" @click="openUpdateDialog">
            <AppIcon name="download" :size="16" />
            <span>版本更新</span>
            <span
              v-if="hasVersionNotice"
              class="version-notice-dot menu-version-notice"
              role="img"
              aria-label="版本更新提醒"
            />
          </button>
          <button type="button" role="menuitem" @click="openContactDialog">
            <AppIcon name="message" :size="16" />
            <span>联系作者</span>
          </button>
          <button type="button" role="menuitem" @click="openSupportDialog">
            <AppIcon name="sparkles" :size="16" />
            <span>赞赏作者</span>
          </button>
        </div>
      </div>

      <button
        class="icon-button account-settings-button"
        type="button"
        aria-label="打开设置"
        title="设置"
        @click="openSettings"
      >
        <AppIcon name="settings" :size="16" />
      </button>
    </div>
  </footer>
  <AuthorSupportDialog
    v-if="profileDialog === 'support'"
    @close="closeProfileDialog"
  />
  <Teleport to="body">
    <div
      v-if="profileDialog === 'contact'"
      class="dialog-backdrop"
      @mousedown.self="closeProfileDialog"
    >
      <section
        class="workspace-dialog profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-author-dialog-title"
      >
        <header>
          <div>
            <span class="dialog-eyebrow">DeepWrite</span>
            <h2 id="contact-author-dialog-title">联系作者</h2>
          </div>
          <button
            class="dialog-close"
            type="button"
            aria-label="关闭"
            @click="closeProfileDialog"
          >
            ×
          </button>
        </header>

        <div class="dialog-content">
          <p class="dialog-description contact-author-description">
            如果你有任何反馈，或者想体验最新版本，请添加作者微信并加入交流群。
          </p>
          <div class="author-contact-card">
            <span>微信号</span>
            <strong>deepseekwrite</strong>
          </div>
          <div class="dialog-actions">
            <button
              class="dialog-primary-button"
              type="button"
              @click="closeProfileDialog"
            >
              我知道了
            </button>
          </div>
        </div>
      </section>
    </div>

    <VersionUpdateDialog
      v-if="profileDialog === 'update'"
      :update-state="updateState"
      :announced-version="announcedVersion"
      :official-docs-url="officialDocsUrl"
      :manual-update-required="manualUpdateRequired"
      @close="closeProfileDialog"
      @check="checkUpdate"
      @download="downloadUpdate"
      @install="installUpdate"
    />
  </Teleport>
</template>

<style scoped>
.account-avatar {
  position: relative;
}
.version-notice-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger, #dc3545);
  box-shadow: 0 0 0 2px var(--surface-raised);
}
.avatar-version-notice {
  position: absolute;
  top: 0;
  right: 0;
}
.account-menu button:has(.menu-version-notice) {
  grid-template-columns: 22px minmax(0, 1fr) 8px;
}
</style>
