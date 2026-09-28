<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  MarketplaceLoginInputSchema,
  MarketplaceRegisterInputSchema,
  type MarketplaceSession
} from "@deepwrite/contracts/renderer";
import { uiMessage } from "../ui-feedback";
import { marketplaceAccountError } from "../utils/marketplaceAccountError";
import MarketplaceEmailFields from "./MarketplaceEmailFields.vue";
const emit = defineEmits<{ authenticated: [session: MarketplaceSession] }>();
const authMode = ref<"login" | "register">("login");
const pending = ref(false);
const sending = ref(false);
const username = ref("");
const password = ref("");
const displayName = ref("");
const email = ref("");
const emailCode = ref("");
let alive = true;
onUnmounted(() => {
  alive = false;
});
async function submitAuth(): Promise<void> {
  const api = window.deepwrite;
  if (!api || pending.value || sending.value) return;
  const credentials = {
    username: username.value.trim(),
    password: password.value
  };
  const login = MarketplaceLoginInputSchema.safeParse(credentials);
  const registration = MarketplaceRegisterInputSchema.safeParse({
    ...credentials,
    displayName: displayName.value.trim() || undefined,
    email: email.value,
    emailCode: emailCode.value
  });
  if (authMode.value === "login" ? !login.success : !registration.success) {
    uiMessage.warning(
      authMode.value === "login"
        ? "请输入有效的用户名和密码。"
        : "请填写用户名、至少 8 位密码、有效邮箱和 6 位验证码。"
    );
    return;
  }
  pending.value = true;
  try {
    const session =
      authMode.value === "login" && login.success
        ? await api.marketplace.login(login.data)
        : registration.success
          ? await api.marketplace.register(registration.data)
          : null;
    if (!alive || !session) return;
    password.value = "";
    emailCode.value = "";
    uiMessage.success(
      authMode.value === "login" ? "登录成功" : "注册并登录成功"
    );
    emit("authenticated", session);
  } catch (error: unknown) {
    if (alive)
      uiMessage.error(
        marketplaceAccountError(error, "登录或注册失败，请稍后重试。")
      );
  } finally {
    if (alive) pending.value = false;
  }
}
</script>
<template>
  <section class="auth-shell">
    <div class="auth-card">
      <div class="auth-tabs" role="tablist" aria-label="登录或注册">
        <button
          v-for="mode in ['login', 'register'] as const"
          :key="mode"
          type="button"
          role="tab"
          :aria-selected="authMode === mode"
          :class="{ active: authMode === mode }"
          :disabled="pending || sending"
          @click="authMode = mode"
        >
          {{ mode === "login" ? "登录" : "注册" }}
        </button>
      </div>
      <form class="auth-form" @submit.prevent="submitAuth">
        <label
          ><span>用户名</span
          ><input
            v-model="username"
            autocomplete="username"
            maxlength="120"
            required
            :disabled="pending"
        /></label>
        <label
          ><span>密码</span
          ><input
            v-model="password"
            type="password"
            :autocomplete="
              authMode === 'login' ? 'current-password' : 'new-password'
            "
            maxlength="128"
            required
            :disabled="pending"
        /></label>
        <template v-if="authMode === 'register'">
          <label
            ><span>显示名（可选）</span
            ><input
              v-model="displayName"
              autocomplete="nickname"
              maxlength="120"
              :disabled="pending"
          /></label>
          <MarketplaceEmailFields
            v-model:email="email"
            v-model:code="emailCode"
            purpose="register"
            :disabled="pending"
            @sending="sending = $event"
          />
        </template>
        <button
          class="primary-button"
          type="submit"
          :disabled="pending || sending"
        >
          {{
            pending ? "请稍候…" : authMode === "login" ? "登录" : "注册并登录"
          }}
        </button>
        <small
          >老用户可直接登录，邮箱绑定为可选操作。登录会话有效期为 30
          天；安全存储不可用时仅保留到本次运行结束。</small
        >
      </form>
    </div>
  </section>
</template>
<style scoped src="./marketplace-account.css"></style>
