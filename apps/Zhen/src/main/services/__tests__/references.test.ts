import assert from "node:assert/strict";
import test from "node:test";

import { planPlayerDetach, planTeamDetach } from "../../../renderer/src/utils/references.ts";

test("planPlayerDetach: 只更新包含该玩家的战队", () => {
  const teams = [
    { id: "t1", playerIds: ["p1", "p2"] },
    { id: "t2", playerIds: ["p3"] },
    { id: "t3" },
  ];

  assert.deepEqual(planPlayerDetach("p1", teams), [{ id: "t1", playerIds: ["p2"] }]);
});

test("planPlayerDetach: 没有引用时返回空数组", () => {
  assert.deepEqual(planPlayerDetach("p9", [{ id: "t1", playerIds: ["p1"] }]), []);
});

test("planTeamDetach: 清空比赛中的队伍引用与对应比分", () => {
  const matches = [
    { id: "m1", matchTeamA: "t1", matchTeamB: "t2", matchTeamAScore: 2, matchTeamBScore: 1 },
    { id: "m2", matchTeamA: "t3", matchTeamB: "t1", matchTeamAScore: 1, matchTeamBScore: 3 },
    { id: "m3", matchTeamA: "t2", matchTeamB: "t3" },
  ];

  assert.deepEqual(planTeamDetach("t1", matches), [
    { id: "m1", patch: { matchTeamA: "", matchTeamAScore: 0 } },
    { id: "m2", patch: { matchTeamB: "", matchTeamBScore: 0 } },
  ]);
});