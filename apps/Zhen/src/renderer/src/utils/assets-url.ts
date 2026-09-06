const ASSET_BASE = "http://127.0.0.1:1469/assets";

export function getAssetUrl(relativePath: string): string {
  if (!relativePath) return "";
  if (relativePath.startsWith("http") || relativePath.startsWith("data:")) {
    return relativePath;
  }
  return `${ASSET_BASE}/${relativePath}`;
}
