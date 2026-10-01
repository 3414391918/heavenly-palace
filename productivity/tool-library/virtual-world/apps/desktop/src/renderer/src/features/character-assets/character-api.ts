export function characterApi() {
  const api = window.deepwrite?.long;
  if (!api) throw new Error("桌面服务不可用，请在虚拟世界桌面端打开。");
  return api;
}
