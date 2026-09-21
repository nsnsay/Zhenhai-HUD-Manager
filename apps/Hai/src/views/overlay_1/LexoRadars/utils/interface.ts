import type { Bomb, Grenade, Player, Side } from '@zhenhai/csgogsi/types'

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
 * inferno 不走这条通道（它没有单点位置），统一由 RadarFireObject 表达。
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

/**
 * 雷达火焰区域对象（inferno）。
 *
 * 一个火区对应一个地图图层上的一块燃烧区域：cells 是该层可见火点在雷达坐标系里的坐标，
 * radius 是每团火的覆盖半径（雷达像素），轮廓由 utils/fire.ts 取凸包后向外扩张得到。
 * 单层地图的 id 就是 grenade.id，多层地图（如 Nuke）是 `${grenade.id}_${图层 id}`。
 */
export type RadarFireObject = {
  id: string
  cells: [number, number][]
  radius: number
  visible: boolean
}

/**
 * 雷达炸弹对象（已换算到雷达坐标）。
 *
 * 单层地图 id 就是 `bomb`，多层地图是 `bomb_${图层 id}`，
 * 每种渲染器再各自决定怎么画（DOM 用 class/style，画布用坐标）。
 */
export type RadarBombObject = {
  id: string
  state: Bomb['state']
  position: [number, number]
  visible: boolean
}

/**
 * 投掷物轨迹（已飞过的路径）。
 *
 * 只在雷达坐标系里保存渲染用的点位，因此轨迹与投掷物点位严格贴合。
 * 单层地图的 id 就是 grenade.id，多层地图（如 Nuke）是 `${grenade.id}_${图层 id}`，
 * 天然按图层隔离，避免上下层互相连线。
 */
export type RadarTrail = {
  id: string
  side: Side | null
  points: [number, number][]
  /**
   * 已经因为超出点数上限而被裁掉的那段路径长度。
   *
   * 虚线相位是相对折线首点算的，首点一往前挪图案就会整条滑动，
   * 记下裁掉的长度再用 lineDashOffset 补回去，虚线才会稳稳留在原地。
   */
  removedLength: number
  /** 当前图层是否可见，与投掷物点位使用同一份判定结果。 */
  visible: boolean
  /** 进入淡出的时间戳；null 表示轨迹仍在生长。 */
  stoppedAt: number | null
  /** 连续多少个数据包没有新增点，达到阈值即判定停止移动。 */
  idleFrames: number
}
