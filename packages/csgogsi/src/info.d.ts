export interface MatchsInfo {
  matchType: string;
  matchLength: number;
  matchVeto: MapVeto[];
  matchTeamA: string; // 建议改为 string，因为实际存的是 Team ID
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
  extras?: Record;
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
  playerIds: string[]; // ✅ 新增：关联玩家 ID 列表
}

export type ComponentMode = false | "mode1" | "mode2";

export type WindowMaterial = "none" | "acrylic" | "mica";

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
  overlayKillfeedMode: ComponentMode;
  overlayBorderRadius: number;
  overlayRefreshShortcut: string;
  overlaySafeZoneX: number;
  overlaySafeZoneY: number;
  extras: Record<string, unknown>;
  windowMaterial: WindowMaterial;
  cs2Path: string;
  firstStartFinished: boolean;
}
