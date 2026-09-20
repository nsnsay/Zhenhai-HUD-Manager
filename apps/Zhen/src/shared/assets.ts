import { assetsBaseUrl } from "./server";

/**
 * 把数据库里存的相对资源路径补全为本地服务的绝对地址。
 *
 * main（GSI 管线注入给 Overlay）与 renderer（表单预览）共用这一份实现。
 */
export function getAssetUrl(relativePath: string | null | undefined): string {
  if (!relativePath) {
    return "";
  }

  if (relativePath.startsWith("http") || relativePath.startsWith("data:")) {
    return relativePath;
  }

  return `${assetsBaseUrl()}/${relativePath.replace(/^\/+/, "")}`;
}