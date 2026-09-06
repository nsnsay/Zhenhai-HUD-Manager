import type { Team, TeamFormData, TeamInfo } from "@zhenhai/csgogsi/types";
import type { DatabaseService } from "../database.service";
import type { GsiMiddleware } from "../gsi-pipeline.service";
import type { CSGO } from "@zhenhai/csgogsi";

const ASSET_BASE = "http://127.0.0.1:1469/assets";

function getAssetUrl(relativePath: string): string {
  if (!relativePath) return "";
  if (relativePath.startsWith("http") || relativePath.startsWith("data:")) return relativePath;
  return `${ASSET_BASE}/${relativePath}`;
}

interface DbPlayer {
  id?: string;
  playerSteamID?: string | number;
}

interface DbTeam extends TeamFormData {
  id: string;
}

type TeamDbExtension = TeamInfo &
  TeamFormData & {
    matchTeamScore: number;
  };

interface DbMatch {
  id: string;
  isLive?: boolean;
  matchTeamA?: string;
  matchTeamB?: string;
  matchTeamAScore?: number;
  matchTeamBScore?: number;
}

function createTeamEnricher(dbService: DatabaseService): GsiMiddleware {
  return (data: CSGO) => {
    if (!data || !data.map) return data;

    const teamsResult = dbService.list("teams");
    const playersResult = dbService.list("players");
    const matchsResult = dbService.list("matchs");

    const dbTeams = (teamsResult.success && teamsResult.data
      ? teamsResult.data
      : []) as unknown as DbTeam[];
    const dbPlayers = (playersResult.success && playersResult.data
      ? playersResult.data
      : []) as unknown as DbPlayer[];
    const dbMatchs = (matchsResult.success && matchsResult.data
      ? matchsResult.data
      : []) as unknown as DbMatch[];

    const playerIdToSteamId = new Map<string, string>();
    for (const p of dbPlayers) {
      if (p.id && p.playerSteamID) playerIdToSteamId.set(p.id, String(p.playerSteamID));
    }

    const steamIdToDbTeam = new Map<string, DbTeam>();
    for (const team of dbTeams) {
      if (Array.isArray(team.playerIds)) {
        for (const pid of team.playerIds) {
          const steamId = playerIdToSteamId.get(pid);
          if (steamId) steamIdToDbTeam.set(steamId, team);
        }
      }
    }

    const ctSteamIds: string[] = [];
    const tSteamIds: string[] = [];
    if (Array.isArray(data.players)) {
      for (const p of data.players) {
        if (p.team?.side === "CT" && p.steamid) ctSteamIds.push(p.steamid);
        else if (p.team?.side === "T" && p.steamid) tSteamIds.push(p.steamid);
      }
    }

    const matchDbTeam = (gsiTeamName: string, teamSteamIds: string[]) => {
      let directMatch = dbTeams.find(
        (t) => t.teamGameName === gsiTeamName || t.teamName === gsiTeamName,
      );
      if (directMatch) return directMatch;

      for (const steamId of teamSteamIds) {
        const dbTeam = steamIdToDbTeam.get(steamId);
        if (dbTeam && (dbTeam.teamGameName === gsiTeamName || dbTeam.teamName === gsiTeamName))
          return dbTeam;
      }

      for (const steamId of teamSteamIds) {
        const dbTeam = steamIdToDbTeam.get(steamId);
        if (dbTeam) return dbTeam;
      }
      return null;
    };

    const injectTeamDb = (gsiTeam: Team, dbTeam: DbTeam) => {
      if (!gsiTeam || !dbTeam) return;

      let matchTeamScore = 0;

      const liveMatch = dbMatchs.find((m) => m.isLive === true);

      if (liveMatch) {
        if (liveMatch.matchTeamA === dbTeam.id) {
          matchTeamScore = Number(liveMatch.matchTeamAScore ?? 0);
        } else if (liveMatch.matchTeamB === dbTeam.id) {
          matchTeamScore = Number(liveMatch.matchTeamBScore ?? 0);
        }
      }

      const extension: TeamDbExtension = {
        id: dbTeam.id,
        teamId: dbTeam.id,
        teamName: dbTeam.teamName,
        teamGameName: dbTeam.teamGameName,
        teamLogo: getAssetUrl(dbTeam.teamLogo),
        teamCountry: dbTeam.teamCountry,
        teamShortName: dbTeam.teamShortName,
        matchTeamScore,
        playerIds: dbTeam.playerIds,
      };
      gsiTeam._db = extension;
    };

    if (data.map.team_ct) {
      const dbTeamCt = matchDbTeam(data.map.team_ct.name, ctSteamIds);
      if (dbTeamCt) injectTeamDb(data.map.team_ct, dbTeamCt);
    }
    if (data.map.team_t) {
      const dbTeamT = matchDbTeam(data.map.team_t.name, tSteamIds);
      if (dbTeamT) injectTeamDb(data.map.team_t, dbTeamT);
    }

    if (Array.isArray(data.players)) {
      for (const p of data.players) {
        if (p.team?.side === "CT" && data.map.team_ct?._db) p.team._db = data.map.team_ct._db;
        else if (p.team?.side === "T" && data.map.team_t?._db) p.team._db = data.map.team_t._db;
      }
    }

    if (data.player?.team) {
      if (data.player.team.side === "CT" && data.map.team_ct?._db)
        data.player.team._db = data.map.team_ct._db;
      else if (data.player.team.side === "T" && data.map.team_t?._db)
        data.player.team._db = data.map.team_t._db;
    }

    return data;
  };
}

export default createTeamEnricher;
