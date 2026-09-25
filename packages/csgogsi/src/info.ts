/**
 * [ZhenHai] 本仓库的业务类型（与原 packages/csgogsi/src/info.d.ts 保持一致）。
 *
 * 这些类型不属于上游 csgogsi，只是历史上挂在同一个包下对外导出。
 * 迁移到薄壳后原样保留，确保 `@zhenhai/csgogsi/types` 的导入方零改动。
 */
import type { RadarDock } from "./radar-settings";

export interface MatchsInfo {
  matchType: string;
  matchLength: number;
  matchVeto: MapVeto[];
  matchTeamA: string; // 实际存的是 Team ID
  matchTeamB: string;
  matchTeamAScore: number;
  matchTeamBScore: number;
  isLive: boolean;
  tournament?: TournamentInfo | null;
  teamA?: TeamInfo | null;
  teamB?: TeamInfo | null;
}

export interface TournamentFormData {
  tournamentName: string;
  tournamentLogo: string;
  tournamentDescription: string;
}

export interface TournamentInfo extends TournamentFormData {
  id: string;
}

export interface TeamInfo extends TeamFormData {
  id: string;
  teamId: string;
  matchTeamScore?: number;
}

export interface MatchTeam {
  id?: string;
  createAt?: string;
  teamName: string;
  teamLogo: string;
  teamId: string;
  teamCountry: string;
  teamGameName: string;
  teamMatchScore: number;
}

export type MapVeto = MapBanVeto | MapPickVeto | MapPickDecider;

export interface MapBanVeto {
  mapName: string;
  mapVetoType: "ban";
  mapBanTeam: string;
}

export interface MapPickVeto {
  mapName: string;
  mapVetoType: "pick";
  mapPickTeam: string;
  mapPickEnemySide: "CT" | "T";
  mapPickTeamScore: number;
  mapPickEnemyScore: number;
}

export interface MapPickDecider {
  mapName: string;
  mapVetoType: "decider";
  mapTeamAScore: number;
  mapTeamBScore: number;
}

export interface PlayerInfo {
  playerName: string;
  playerRealName: string;
  playerId: string;
  playerAvatar: string;
  playerSteamID: string;
  playerCountry: string;
  extras?: Record<string, unknown>;
}

export interface PlayerFormData {
  playerName: string;
  playerRealName: string;
  playerAvatar: string;
  playerSteamID: string;
  playerCountry: string;
  playerCameraURL: string;
}

export interface TeamFormData {
  teamName: string;
  teamShortName: string;
  teamLogo: string;
  teamCountry: string;
  teamGameName: string;
  playerIds: string[];
}

export type ComponentMode = false | "mode1" | "mode2";

export type WindowMaterial = "none" | "acrylic" | "mica";

/** 管理端界面语言偏好；system 表示跟随操作系统。 */
export type LanguagePreference = "system" | "zh-CN" | "en-US";

export interface SettingFormData {
  ctDefaultColor: string;
  tDefaultColor: string;
  primaryDefaultColor: string;
  secondaryDefaultColor: string;
  overlayPlayerSidebarMode: ComponentMode;
  overlayPlayerFocusedMode: ComponentMode;
  overlayMatchBarMode: ComponentMode;
  overlayMatchInfoMode: ComponentMode;
  overlayRadarMode: ComponentMode;
  /** 雷达是否按「当前可见且存活的选手包围盒」自动放大。 */
  overlayRadarAutoZoom: boolean;
  /** 雷达显示尺寸（屏幕像素）。 */
  overlayRadarSize: number;
  /** 雷达停靠在地图的哪个角。 */
  overlayRadarDock: RadarDock;
  /** 自动放大的倍率上限。 */
  overlayRadarZoomMax: number;
  /** 自动取景留白，1024 雷达坐标系单位。 */
  overlayRadarFocusPadding: number;
  /** 玩家标记直径，1024 雷达坐标系单位。 */
  overlayRadarPlayerSize: number;
  /** 落地烟雾覆盖直径，1024 雷达坐标系单位。 */
  overlayRadarSmokeSize: number;
  /** 火焰区域轮廓描边宽度，1024 雷达坐标系单位。 */
  overlayRadarFireStroke: number;
  overlayKillfeedMode: ComponentMode;
  overlayBorderRadius: number;
  overlayRefreshShortcut: string;
  overlayMouseToggleShortcut: string;
  overlaySafeZoneX: number;
  overlaySafeZoneY: number;
  extras: Record<string, unknown>;
  windowMaterial: WindowMaterial;
  cs2Path: string;
  allowLanAccess: boolean;
  firstStartFinished: boolean;
  language: LanguagePreference;
  selectedOverlayId: string;
}
