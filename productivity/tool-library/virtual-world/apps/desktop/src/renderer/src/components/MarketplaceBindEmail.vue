<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  MarketplaceBindEmailInputSchema,
  type MarketplaceSession
} from "@deepwrite/contracts/renderer";
import { uiMessage } from "../ui-feedback";
import { marketplaceAccountError } from "../utils/marketplaceAccountError";
import MarketplaceEmailFields from "./MarketplaceEmailFields.vue";
const props = defineProps<{ session: MarketplaceSession }>();
const emit = defineEmits<{ updated: [session: MarketplaceSession] }>();
const open = ref(false);
const email = ref(props.session.user?.email ?? "");
const emailCode = ref("");
const pending = ref(false);
const sending = ref(false);
let alive = true;
onUnmounted(() => {
  alive = false;
});
async function bind(): Promise<void> {
  const api = window.deepwrite?.marketplace;
  if (!api || pending.value || sending.value) return;
  const parsed = MarketplaceBindEmailInputSchema.safeParse({
    email: email.value,
    emailCode: emailCode.value
  });
  if (!parsed.success) {
    uiMessage.warning("请填写有效邮箱和 6 位验证码。");
    return;
  }
  pending.value = true;
  try {
    const session = await api.bindEmail(parsed.data);
    if (!alive) return;
    emailCode.value = "";
    open.value = false;
    emit("updated", session);
    uiMessage.success("邮箱已验证并绑定。");
  } catch (error: unknown) {
    if (alive)
      uiMessage.error(
        marketplaceAccountError(error, "邮箱绑定失败，请稍后重试。")
      );
  } finally {
    if (alive) pending.value = false;
  }
}
</script>
<template>
  <span v-if="session.user?.emailVerifiedAt" class="verified">邮箱已验证</span>
  <div v-else class="bind-entry">
    <button
      type="button"
      :aria-expanded="open"
      :disabled="pending || sending"
      @click="open = !open"
    >
      {{ open ? "暂不绑定" : "绑定邮箱（可选）" }}
    </button>
    <form
      v-if="open"
      class="bind-form"
      aria-label="绑定邮箱"
      @submit.prevent="bind"
    >
      <p>老用户可以自愿绑定邮箱，不绑定也能继续正常使用。</p>
      <MarketplaceEmailFields
        v-model:email="email"
        v-model:code="emailCode"
        purpose="account"
        :disabled="pending"
        @sending="sending = $event"
      />
      <button
        class="primary-button"
        type="submit"
        :disabled="pending || sending"
      >
        {{ pending ? "验证中…" : "验证并绑定" }}
      </button>
    </form>
  </div>
</template>
<style scoped src="./marketplace-account.css"></style>
