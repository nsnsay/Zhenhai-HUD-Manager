import type { Grenade, Player, Side } from '@zhenhai/csgogsi/types'

export type RadarGrenadeState = 'inair' | 'landed' | 'exploded'

/**
 * 雷达玩家对象
 *
 * 现在直接基于当前软件真实的 Player 数据结构。
 *
 * 保留/扩展雷达专用字段：
 * - id：用于 v-for，多层地图时会是 `${steamid}_${configId}`
 * - side：快捷访问 player.team.side
 * - position：雷达坐标 [x, y, deg]
 * - visible：多层地图可见性
 * - isActive：等价于旧逻辑中的当前聚焦玩家，现在由 isFocused 派生
 * - isAlive：由 state.health 派生
 * - hasBomb：由 isBomb 派生
 * - isFlashed：由 state.flashed 派生
 * - isShooting：雷达射击状态
 * - lastShoot：最近射击时间戳
 * - scale：雷达缩放
 */
export type RadarPlayerObject = Player & {
  id: string
  side: Side
  position: [number, number, number]
  visible: boolean
  isActive: boolean
  isAlive: boolean
  hasBomb: boolean
  isFlashed: boolean
  isShooting: boolean
  lastShoot: number
  scale: number
}

/**
 * 雷达峰面渲染对象
 *
 * 现在直接基于当前软件真实的 Grenade 数据结构。
 * 对于 inferno，会展开成火焰点位，但仍然保留 Grenade 基础字段。
 */
export type RadarGrenadeObject = Grenade & {
  state: RadarGrenadeState
  side: Side | null
  position: number[]
  visible: boolean
}

/**
 * 扩展原始 Grenade，补充归属 side。
 */
export type ExtendedGrenade = Grenade & {
  side: Side | null
}
