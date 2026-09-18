import assert from "node:assert/strict";
import test from "node:test";

import type { GameState, GameStateRaw } from "@zhenhai/csgogsi/types";

import { ZhenHaiGSI } from "../gsi-enrich.service.ts";

type Side = "CT" | "T";

function rawPlayer(steamid: string, team: Side, observerSlot: number) {
  return {
    steamid,
    name: `player-${steamid}`,
    observer_slot: observerSlot,
    team,
    match_stats: { kills: 0, assists: 0, deaths: 0, mvps: 0, score: 0 },
    weapons: {},
    state: {
      health: 100,
      armor: 0,
      helmet: false,
      flashed: 0,
      burning: 0,
      money: 800,
      round_kills: 0,
      round_killhs: 0,
      round_totaldmg: 0,
      equip_value: 1000,
    },
    position: "0, 0, 0",
    forward: "1, 0, 0",
  };
}

function createPacket(options: {
  round: number;
  mapPhase: "warmup" | "live" | "gameover";
  roundPhase: "freezetime" | "live" | "over";
  countdownPhase: "warmup" | "live" | "freezetime";
  winTeam?: Side;
}): GameStateRaw {
  return {
    provider: {
      name: "Counter-Strike: Global Offensive",
      appid: 730,
      version: 1,
      steamid: "1",
      timestamp: 1,
    },
    map: {
      mode: "competitive",
      name: "de_mirage",
      phase: options.mapPhase,
      round: options.round,
      team_ct: {
        score: 0,
        consecutive_round_losses: 0,
        timeouts_remaining: 3,
        matches_won_this_series: 0,
        name: "CT",
      },
      team_t: {
        score: 0,
        consecutive_round_losses: 0,
        timeouts_remaining: 3,
        matches_won_this_series: 0,
        name: "T",
      },
      num_matches_to_win_series: 1,
      current_spectators: 0,
      souvenirs_total: 0,
      round_wins: {},
    },
    round: {
      phase: options.roundPhase,
      win_team: options.winTeam,
    },
    allplayers: {
      "1": rawPlayer("1", "CT", 1),
      "2": rawPlayer("2", "T", 2),
    },
    phase_countdowns: {
      phase: options.countdownPhase,
      phase_ends_in: "5",
    },
    grenades: {},
  };
}

function createHarness(options: { shouldEnrich?: boolean } = {}) {
  const warnings: string[] = [];
  let enrichCalls = 0;

  const gsi = new ZhenHaiGSI({
    shouldEnrich: () => options.shouldEnrich ?? true,
    enrich: (data: GameState) => {
      enrichCalls += 1;
      data.map.team_ct.country = "ZZ";
      return data;
    },
    onWarn: (message) => warnings.push(message),
  });

  return {
    gsi,
    warnings,
    enrichCount: () => enrichCalls,
  };
}

const livePacket = { round: 0, mapPhase: "live", roundPhase: "live", countdownPhase: "live" } as const;

test("首包会增强，且 data 回调里能看到增强结果", () => {
  const { gsi, enrichCount } = createHarness();
  let seenInCallback: string | null = null;

  gsi.on("data", (data) => {
    seenInCallback = data.map.team_ct.country;
  });

  gsi.digest(createPacket(livePacket));

  assert.equal(enrichCount(), 1);
  assert.equal(seenInCallback, "ZZ");
});

test("同一快照只增强一次（warmup 包会派发 warmupStart + data）", () => {
  const { gsi, enrichCount } = createHarness();
  let emits = 0;

  gsi.on("warmupStart", () => {
    emits += 1;
  });
  gsi.on("data", () => {
    emits += 1;
  });

  gsi.digest(
    createPacket({
      round: 0,
      mapPhase: "warmup",
      roundPhase: "freezetime",
      countdownPhase: "warmup",
    }),
  );

  assert.equal(emits, 2);
  assert.equal(enrichCount(), 1);
});

test("raw 事件不触发增强", () => {
  const { gsi, enrichCount } = createHarness();
  let countInRawListener = -1;

  gsi.on("raw", () => {
    countInRawListener = enrichCount();
  });

  gsi.digest(createPacket(livePacket));

  assert.equal(countInRawListener, 0);
  assert.equal(enrichCount(), 1);
});

test("shouldEnrich 为 false 时整条管线不执行", () => {
  const { gsi, enrichCount } = createHarness({ shouldEnrich: false });

  gsi.digest(createPacket(livePacket));

  assert.equal(enrichCount(), 0);
});

test("上游不变量：roundEnd 派发前 current 已增强", () => {
  const { gsi, enrichCount } = createHarness();
  const seen: Array<{ winnerCountry: string | null; currentCountry: string | null }> = [];

  gsi.on("roundEnd", (event) => {
    seen.push({
      winnerCountry: event.winner.country,
      currentCountry: gsi.current?.map.team_ct.country ?? null,
    });
  });

  gsi.digest(createPacket(livePacket));
  gsi.digest(
    createPacket({ round: 1, mapPhase: "live", roundPhase: "over", countdownPhase: "live", winTeam: "CT" }),
  );

  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.winnerCountry, "ZZ");
  assert.equal(seen[0]?.currentCountry, "ZZ");
  assert.equal(enrichCount(), 2);
});

test("解析器元信息（regularMR/overtimeMR）会注入到 map", () => {
  const { gsi } = createHarness();

  gsi.digest(createPacket(livePacket));

  assert.equal(gsi.current?.map.regularMR, 12);
  assert.equal(gsi.current?.map.overtimeMR, 3);
});

test("管线返回新对象时告警一次且不阻断派发", () => {
  const warnings: string[] = [];
  let calls = 0;

  const gsi = new ZhenHaiGSI({
    shouldEnrich: () => true,
    enrich: (data) => {
      calls += 1;
      return { ...data, map: { ...data.map, name: "de_replaced" } };
    },
    onWarn: (message) => warnings.push(message),
  });

  let seenName: string | null = null;
  gsi.on("data", (data) => {
    // 事件载荷仍指向旧对象（契约要求原地修改），此处只验证不抛错。
    seenName = data.map.name;
  });

  gsi.digest(createPacket(livePacket));

  assert.equal(calls, 1);
  assert.equal(warnings.length, 1);
  assert.equal(gsi.current?.map.name, "de_replaced");
  assert.equal(seenName, "de_mirage");
});