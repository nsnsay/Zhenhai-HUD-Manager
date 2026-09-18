/**
 * [ZhenHai] 本地差异 #2：业务注入字段的类型增补。
 *
 * 上游 csgogsi 只负责解析游戏数据，不认识本项目管理端的数据库记录（`_db`）、
 * Overlay 渲染所需的派生字段，以及解析器元信息（regularMR / overtimeMR）。
 * 这些字段由 apps/Zhen 的增强管线在事件派发前写入，这里只做类型合并。
 *
 * 前提：上游发布物 dist/index.d.mts 为单文件内联声明（csgogsi@6.0.1 已实测满足），
 * 否则需要退回“应用侧类型 overlay”方案。
 */
import type { Weapon } from "csgogsi";
import type { MatchsInfo, PlayerFormData, SettingFormData, TeamInfo } from "./info";

declare module "csgogsi" {
  interface Player {
    /** 是否为当前观战对象（player 管线写入）。 */
    isFocused: boolean | null;
    isDead: boolean | null;
    isArmorHelmet: boolean | null;
    isArmor: boolean | null;
    isBomb: boolean | null;
    grenades: Weapon[];
    primaryweapon: Weapon | undefined;
    secondaryweapon: Weapon | undefined;
    knifeweapon: Weapon | undefined;
    activeweapon: Weapon | undefined;
    /** 对应管理端 players 集合中的记录。 */
    _db: PlayerFormData | null;
  }

  interface Team {
    /** 对应管理端 teams 集合中的记录。 */
    _db?: TeamInfo | undefined;
  }

  interface MapState {
    /** 解析器 regulationMR，由 ZhenHaiGSI 在派发前注入。 */
    regularMR: number;
    /** 解析器 overtimeMR，由 ZhenHaiGSI 在派发前注入。 */
    overtimeMR: number;
  }

  interface GameState {
    /** 由 match 管线注入的当前 Live 比赛信息。 */
    matchinfo?: MatchsInfo;
    /** 由 settings 管线注入的 Overlay 配置。 */
    settings?: SettingFormData;
  }
}