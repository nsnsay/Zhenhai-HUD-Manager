import type { CSGO } from "@zhenhai/csgogsi";
import type { DatabaseService } from "../database.service";
import type { GsiMiddleware } from "../gsi-pipeline.service";
import type {
  MatchsInfo,
  TeamFormData,
  TeamInfo,
  TournamentFormData,
  TournamentInfo,
} from "@zhenhai/csgogsi/types";

const ASSET_BASE = "http://127.0.0.1:1469/assets";

function getAssetUrl(relativePath: string): string {
  if (!relativePath) return "";
  if (relativePath.startsWith("http") || relativePath.startsWith("data:")) {
    return relativePath;
  }
  return `${ASSET_BASE}/${relativePath}`;
}

interface DbMatch extends MatchsInfo {
  id: string;
  tournamentId?: string;
}

interface DbTeam extends TeamFormData {
  id: string;
  matchTeamScore?: number;
}

interface DbTournament extends TournamentFormData {
  id: string;
}

function toTeamInfo(team: DbTeam, matchTeamScore: number): TeamInfo {
  return {
    id: team.id,
    teamId: team.id,
    matchTeamScore,
    teamName: team.teamName,
    teamShortName: team.teamShortName,
    teamLogo: getAssetUrl(team.teamLogo),
    teamCountry: team.teamCountry,
    teamGameName: team.teamGameName,
    playerIds: team.playerIds,
  };
}

function createMatchEnricher(dbService: DatabaseService): GsiMiddleware {
  return (data: CSGO) => {
    if (!data) return data;

    const result = dbService.list("matchs");
    if (!result.success || !result.data) {
      data.matchinfo = undefined;
      return data;
    }

    const matches = result.data as unknown as DbMatch[];
    const liveMatch = matches.find((m) => m.isLive === true);

    if (liveMatch) {
      let tournament: TournamentInfo | null = null;
      let teamA: TeamInfo | null = null;
      let teamB: TeamInfo | null = null;

      const teamResult = dbService.list("teams");
      const dbTeams =
        teamResult.success && teamResult.data ? (teamResult.data as unknown as DbTeam[]) : [];

      if (liveMatch.tournamentId) {
        const tournamentResult = dbService.list("tournaments");
        const tournaments =
          tournamentResult.success && tournamentResult.data
            ? (tournamentResult.data as unknown as DbTournament[])
            : [];
        const dbTournament = tournaments.find((item) => item.id === liveMatch.tournamentId);

        if (dbTournament) {
          tournament = {
            id: dbTournament.id,
            tournamentName: dbTournament.tournamentName,
            tournamentLogo: getAssetUrl(dbTournament.tournamentLogo),
            tournamentDescription: dbTournament.tournamentDescription,
          };
        }
      }

      const dbTeamA = dbTeams.find((team) => team.id === liveMatch.matchTeamA);
      const dbTeamB = dbTeams.find((team) => team.id === liveMatch.matchTeamB);

      if (dbTeamA) {
        teamA = toTeamInfo(dbTeamA, liveMatch.matchTeamAScore);
      }

      if (dbTeamB) {
        teamB = toTeamInfo(dbTeamB, liveMatch.matchTeamBScore);
      }

      data.matchinfo = {
        ...liveMatch,
        tournament,
        teamA,
        teamB,
      };
    } else {
      data.matchinfo = undefined;
    }

    return data;
  };
}

export default createMatchEnricher;
