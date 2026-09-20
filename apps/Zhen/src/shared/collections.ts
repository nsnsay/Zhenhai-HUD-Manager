export type CollectionName = "extras" | "players" | "teams" | "matchs" | "tournaments" | "overlays";

/** 集合白名单：main 的 CRUD 服务、HTTP API 与 renderer 共用同一份定义。 */
export const COLLECTION_NAMES: readonly CollectionName[] = [
  "extras",
  "players",
  "teams",
  "matchs",
  "tournaments",
  "overlays",
];

export function isCollectionName(value: unknown): value is CollectionName {
  return typeof value === "string" && (COLLECTION_NAMES as readonly string[]).includes(value);
}