/**
 * Overlay 连接本地服务的地址。
 *
 * 端口需与 apps/Zhen 的 SERVER_PORT（src/shared/server.ts）保持一致；
 * 主机名取自当前页面地址，因此 OBS 浏览器源与内置 Overlay 窗口都能正确连接。
 */
export function apiUrl() {
  const ip = window.location.hostname
  return `http://${ip}:1469`
}