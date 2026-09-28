<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { MarketplaceEmailSchema } from "@deepwrite/contracts/renderer";
import { uiMessage } from "../ui-feedback";
import { marketplaceAccountError } from "../utils/marketplaceAccountError";
const props = defineProps<{
  purpose: "register" | "account";
  disabled: boolean;
}>();
const email = defineModel<string>("email", { required: true });
const code = defineModel<string>("code", { required: true });
const emit = defineEmits<{ sending: [value: boolean] }>();
const deadlines = ref<Record<string, number>>({});
const now = ref(Date.now());
const sending = ref(false);
let alive = true;
let timer: ReturnType<typeof setInterval> | undefined;
const remaining = computed(() =>
  Math.max(
    0,
    Math.ceil(
      ((deadlines.value[email.value.trim().toLowerCase()] ?? 0) - now.value) /
        1000
    )
  )
);
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  alive = false;
  clearInterval(timer);
});
function changeEmail(event: Event): void {
  if (event.target instanceof HTMLInputElement)
    email.value = event.target.value;
  code.value = "";
}
async function send(): Promise<void> {
  const api = window.deepwrite?.marketplace;
  if (!api || props.disabled || sending.value || remaining.value > 0) return;
  const parsed = MarketplaceEmailSchema.safeParse(email.value);
  if (!parsed.success) {
    uiMessage.warning("请先填写有效邮箱。");
    return;
  }
  sending.value = true;
  emit("sending", true);
  try {
    const result = await api.sendEmailCode({
      email: parsed.data,
      purpose: props.purpose
    });
    if (!alive) return;
    now.value = Date.now();
    deadlines.value[parsed.data] = now.value + result.retryAfter * 1000;
    uiMessage.success("验证码已发送，请查看邮箱及垃圾邮件。");
  } catch (error: unknown) {
    if (alive)
      uiMessage.error(
        marketplaceAccountError(error, "验证码发送失败，请稍后重试。")
      );
  } finally {
    if (alive) {
      sending.value = false;
      emit("sending", false);
    }
  }
}
</script>
<template>
  <div class="email-fields">
    <label
      ><span>邮箱</span
      ><input
        :value="email"
        type="email"
        autocomplete="email"
        maxlength="320"
        :disabled="disabled || sending"
        required
        @input="changeEmail"
    /></label>
    <button
      type="button"
      :disabled="disabled || sending || remaining > 0"
      @click="send"
    >
      {{
        sending
          ? "发送中…"
          : remaining > 0
            ? `${remaining} 秒后重发`
            : "发送验证码"
      }}
    </button>
    <label
      ><span>邮箱验证码</span
      ><input
        v-model="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        pattern="[0-9]{6}"
        :disabled="disabled || sending"
        required
    /></label>
    <small>输入邮件中的 6 位验证码，5 分钟内有效。</small>
  </div>
</template>
<style scoped src="./marketplace-account.css"></style>
