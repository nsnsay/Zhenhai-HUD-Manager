/**
 * 删除数据前的交叉引用清理计划（纯函数，无 Vue/Store 依赖，便于单测）。
 *
 * 约定：只返回「需要更新哪些记录」，由调用方通过 store 落地；
 * 这样失败时可以中止删除，避免出现半清理状态。
 */
export interface TeamReference {
  id: string;
  playerIds?: string[];
}

export interface MatchReference {
  id: string;
  matchTeamA?: string;
  matchTeamB?: string;
  matchTeamAScore?: number;
  matchTeamBScore?: number;
}

export interface TeamPlayerIdsPatch {
  id: string;
  playerIds: string[];
}

export interface MatchTeamsPatch {
  id: string;
  patch: {
    matchTeamA?: string;
    matchTeamAScore?: number;
    matchTeamB?: string;
    matchTeamBScore?: number;
  };
}

/** 删除玩家前：把它从各战队的 playerIds 中摘掉。 */
export function planPlayerDetach(
  playerId: string,
  teams: readonly TeamReference[],
): TeamPlayerIdsPatch[] {
  const patches: TeamPlayerIdsPatch[] = [];

  for (const team of teams) {
    if (!Array.isArray(team.playerIds) || !team.playerIds.includes(playerId)) {
      continue;
    }

    patches.push({
      id: team.id,
      playerIds: team.playerIds.filter((id) => id !== playerId),
    });
  }

  return patches;
}

/** 删除战队前：清空引用它的比赛对阵与对应比分（保留比赛本身与 Live 状态）。 */
export function planTeamDetach(
  teamId: string,
  matches: readonly MatchReference[],
): MatchTeamsPatch[] {
  const patches: MatchTeamsPatch[] = [];

  for (const match of matches) {
    const isTeamA = match.matchTeamA === teamId;
    const isTeamB = match.matchTeamB === teamId;

    if (!isTeamA && !isTeamB) {
      continue;
    }

    const patch: MatchTeamsPatch["patch"] = {};

    if (isTeamA) {
      patch.matchTeamA = "";
      patch.matchTeamAScore = 0;
    }

    if (isTeamB) {
      patch.matchTeamB = "";
      patch.matchTeamBScore = 0;
    }

    patches.push({ id: match.id, patch });
  }

  return patches;
}