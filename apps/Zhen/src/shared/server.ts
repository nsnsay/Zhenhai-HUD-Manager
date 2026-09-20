/**
 * 本地服务（Express + Socket.IO）地址的唯一来源。
 *
 * main / preload / renderer 都从这里取端口与 URL，避免 1469 这类常量散落各处。
 */
export const SERVER_PORT = 1469;

/** 仅本机可访问（默认）。 */
export const SERVER_HOST_LOCAL = "127.0.0.1";

/** 允许局域网访问时使用的监听地址。 */
export const SERVER_HOST_LAN = "0.0.0.0";

/** Overlay 页面在开发环境（apps/Hai 的 Vite dev server）的地址。 */
export const OVERLAY_DEV_URL = "http://localhost:1467/overlay/";

export function serverHost(allowLanAccess: boolean): string {
  return allowLanAccess ? SERVER_HOST_LAN : SERVER_HOST_LOCAL;
}

export function serverOrigin(host: string = SERVER_HOST_LOCAL): string {
  return `http://${host}:${SERVER_PORT}`;
}

export function gsiEndpoint(host?: string): string {
  return `${serverOrigin(host)}/gsi`;
}

export function overlayUrl(host?: string): string {
  return `${serverOrigin(host)}/overlay/`;
}

export function apiBaseUrl(host?: string): string {
  return `${serverOrigin(host)}/api`;
}

export function assetsBaseUrl(host?: string): string {
  return `${serverOrigin(host)}/assets`;
}