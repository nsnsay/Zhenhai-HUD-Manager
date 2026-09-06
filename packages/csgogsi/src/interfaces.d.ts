import type { PlayerFormData, TeamInfo } from "./info";

export type * from "./events.d.ts";
export type * from "./parsed.d.ts";
export type * from "./mirv.d.ts";
export type * from "./info.d.ts";
export type { Provider, RoundOutcome, WeaponType, CSGORaw } from "./csgo.d.ts";

export type Side = "CT" | "T";

export interface TeamExtension {
  id: string;
  name: string;
  country: string | null;
  logo: string | null;
  map_score: number;
  extra: Record<string, string>;
  _db?: TeamInfo;
}

export interface PlayerExtension {
  id: string;
  name: string;
  steamid: string;
  realName: string | null;
  country: string | null;
  avatar: string | null;
  extra: Record<string, string>;
  _db?: PlayerFormData | null;
}
