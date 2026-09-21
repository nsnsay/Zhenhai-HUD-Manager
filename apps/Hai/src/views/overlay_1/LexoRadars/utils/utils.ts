// oxlint-disable-next-line no-unused-vars
import type { Grenade, InfernoGrenade, Player, Side, Weapon } from '@zhenhai/csgogsi/types'
import maps, { type MapConfig, type ScaleConfig } from './maps'
import type {
  ExtendedGrenade,
  RadarFireObject,
  RadarGrenadeObject,
  RadarGrenadeState,
  RadarPlayerObject,
  RadarTrail,
} from './interface'
import { clearFires, deriveFlameRadius } from './fire'

export const playersStates: Player[][] = []
export const grenadesStates: Grenade[][] = []

const directions: Record<string, number> = {}
const deadLocations: Record<string, number[]> = {}

export const explosionPlaces: Record<string, number[]> = {}

type ShootingState = {
  ammo: number
  weapon: string
  lastShoot: number
}

const shootingState: Record<string, ShootingState> = {}

export const EXPLODE_TIME_FRAG = 1.6
export const EXPLODE_TIME_FLASH = 1.45

/** 轨迹最多保留的点数，超出后丢弃最旧的点。 */
export const TRAIL_MAX_POINTS = 60

/** 小于该位移（雷达像素）视为没动，不追加新点。 */
export const TRAIL_MIN_MOVE_PX = 0.5

/** 连续多少个数据包没有新点，判定投掷物已停止移动。 */
export const TRAIL_STOP_PACKETS = 2

/** 停止移动后的淡出时长，画布按它换算轨迹透明度。 */
export const TRAIL_FADE_MS = 1500

/** 淡出结束到删除条目之间留的缓冲，避免提前删掉还在过渡的线。 */
export const TRAIL_PRUNE_SLACK_MS = 100

/** 轨迹线宽，单位是 1024 雷达坐标系里的像素。 */
export const TRAIL_STROKE_WIDTH = 6

/** 轨迹虚线样式（实、空的长度）。 */
export const TRAIL_DASH_PATTERN = [14, 10]

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export const round = (n: number): number => {
  const r = 0.02
  return Math.round(n / r) * r
}

export const parsePosition = (position: number[], config: ScaleConfig): [number, number] => {
  const x = position[0] ?? 0
  const y = position[1] ?? 0

  const left = config.origin.x + x * config.pxPerUX
  const top = config.origin.y + y * config.pxPerUY

  return [round(left), round(top)]
}

const calculateDirection = (player: Player): number => {
  const existing = directions[player.steamid]

  if (existing !== undefined && !player.state.health) {
    return existing
  }

  const fwd = player.forward || [0, 1]
  const forwardV1 = fwd[0] ?? 0
  const forwardV2 = fwd[1] ?? 1

  let direction = 0

  const axisA = (Math.asin(clamp(forwardV1, -1, 1)) * 180) / Math.PI
  const axisB = (Math.acos(clamp(forwardV2, -1, 1)) * 180) / Math.PI

  if (axisB < 45) {
    direction = Math.abs(axisA)
  } else if (axisB > 135) {
    direction = 180 - Math.abs(axisA)
  } else {
    direction = axisB
  }

  if (axisA < 0) {
    direction = -(direction -= 360)
  }

  const previous = directions[player.steamid] ?? direction
  let modifier = previous

  modifier -= 360 * Math.floor(previous / 360)
  modifier = -(modifier -= direction)

  if (Math.abs(modifier) > 180) {
    modifier -= (360 * Math.abs(modifier)) / modifier
  }

  directions[player.steamid] = (directions[player.steamid] ?? direction) + modifier

  return directions[player.steamid] ?? direction
}

export const parsePlayerPosition = (
  player: Player,
  mapConfig: ScaleConfig,
): [number, number, number] => {
  const playerData = playersStates
    .slice(0, 5)
    .map((players) => players.find((pl) => pl.steamid === player.steamid))
    .filter((pl): pl is Player => Boolean(pl))

  if (playerData.length === 0) {
    return [0, 0, calculateDirection(player)]
  }

  const positions: [number, number][] = playerData.map((playerEntry) =>
    parsePosition(playerEntry.position, mapConfig),
  )

  const entryAmount = positions.length

  let x = 0
  let y = 0

  for (const position of positions) {
    x += position[0]
    y += position[1]
  }

  const degree = calculateDirection(player)

  return [x / entryAmount, y / entryAmount, Number(degree)]
}

const parseGrenadePosition = (
  grenade: ExtendedGrenade,
  config: ScaleConfig,
): [number, number] | null => {
  if (Object.prototype.hasOwnProperty.call(explosionPlaces, grenade.id)) {
    return parsePosition(explosionPlaces[grenade.id]!, config)
  }

  const grenadeData = grenadesStates
    .slice(0, 5)
    .map((grenades) => grenades.find((gr) => gr.id === grenade.id))
    .filter((gr): gr is Grenade => Boolean(gr))

  if (grenadeData.length === 0) {
    return 'position' in grenade ? parsePosition(grenade.position, config) : null
  }

  const positions: [number, number][] = grenadeData
    .map((grenadeEntry) =>
      'position' in grenadeEntry ? parsePosition(grenadeEntry.position, config) : null,
    )
    .filter((posData): posData is [number, number] => posData !== null)

  if (positions.length === 0) return null

  const entryAmount = positions.length

  let x = 0
  let y = 0

  for (const position of positions) {
    x += position[0]
    y += position[1]
  }

  return [x / entryAmount, y / entryAmount]
}

const isShootingWeapon = (weapon?: Weapon): weapon is Weapon => {
  return Boolean(
    weapon &&
    weapon.state === 'active' &&
    weapon.type !== 'C4' &&
    weapon.type !== 'Knife' &&
    weapon.type !== 'Grenade',
  )
}

const getShootingWeapon = (player: Player): Weapon | undefined => {
  const activeWeapon = player.activeweapon

  if (isShootingWeapon(activeWeapon)) {
    return activeWeapon
  }

  return player.weapons.find(isShootingWeapon)
}

const getRadarGrenadeState = (grenade: ExtendedGrenade): RadarGrenadeState => {
  if (grenade.type === 'smoke') {
    if (grenade.effecttime !== 0) {
      return grenade.effecttime >= 16.5 ? 'exploded' : 'landed'
    }

    return 'inair'
  }

  if (
    (grenade.type === 'flashbang' && grenade.lifetime >= EXPLODE_TIME_FLASH) ||
    (grenade.type === 'frag' && grenade.lifetime >= EXPLODE_TIME_FRAG)
  ) {
    return 'exploded'
  }

  return 'inair'
}

/**
 * 投掷物轨迹缓存，按渲染对象的 id 索引（多层地图会带上图层后缀）。
 * 与 playersStates / shootingState 同级，同属雷达的模块级状态。
 */
export const grenadeTrails: Record<string, RadarTrail> = {}

/** 当前数据包引用，用于让同一份数据的重复求值只记一次点。 */
let trailFrameKey: object | null = null

/** 本数据包内已经追加过点的轨迹 id。 */
let trailFrameTouched = new Set<string>()

/**
 * 开始处理一个新的数据包。
 *
 * 传同一个数据对象引用时视为重复求值，直接返回，
 * 保证同一帧里 computed 被多次求值也不会重复记点。
 */
export const beginTrailFrame = (packet: object | null = null): void => {
  if (packet !== null) {
    if (packet === trailFrameKey) return
    trailFrameKey = packet
  }

  markIdleTrails()
  trailFrameTouched = new Set()
}

/**
 * 结算上一个数据包：没有新增点的轨迹累加空闲帧，达到阈值即开始淡出。
 *
 * 「没有新点」统一覆盖了投掷物落地静止、爆炸后从数据里消失、被清理以及丢包，
 * 因此不需要按道具类型写各自的落地判定。
 */
export const markIdleTrails = (now: number = Date.now()): void => {
  for (const trail of Object.values(grenadeTrails)) {
    if (trailFrameTouched.has(trail.id)) {
      trail.idleFrames = 0
      continue
    }

    trail.idleFrames += 1

    if (trail.stoppedAt === null && trail.idleFrames >= TRAIL_STOP_PACKETS) {
      trail.stoppedAt = now
    }
  }
}

/** 删除淡出已经走完的轨迹。 */
export const pruneTrails = (now: number = Date.now()): void => {
  for (const [id, trail] of Object.entries(grenadeTrails)) {
    if (trail.stoppedAt !== null && now - trail.stoppedAt > TRAIL_FADE_MS + TRAIL_PRUNE_SLACK_MS) {
      delete grenadeTrails[id]
    }
  }
}

/** 清空所有轨迹，供换图与回合开始时调用。 */
export const clearTrails = (): void => {
  for (const id in grenadeTrails) delete grenadeTrails[id]
  trailFrameTouched = new Set()
}

export type RadarTrailPath = {
  id: string
  side: Side | null
  points: [number, number][]
  /** 需要补回给 lineDashOffset 的相位（等于已裁掉的路径长度）。 */
  dashOffset: number
  visible: boolean
  /** 停止移动后的淡出透明度；仍在生长时为 1。 */
  alpha: number
}

/** 画布用的轨迹：直接给点列与透明度，省掉每帧解析 SVG 字符串。 */
export const getTrailRenderablesNumeric = (now: number = Date.now()): RadarTrailPath[] =>
  Object.values(grenadeTrails)
    .filter((trail) => trail.points.length >= 2)
    .map((trail) => ({
      id: trail.id,
      side: trail.side,
      points: trail.points,
      dashOffset: trail.removedLength,
      visible: trail.visible,
      alpha:
        trail.stoppedAt === null ? 1 : Math.max(0, 1 - (now - trail.stoppedAt) / TRAIL_FADE_MS),
    }))

/**
 * 记录一个轨迹点。
 *
 * 位置与上一个点几乎重合时不算移动（不追加点，也不刷新空闲计数），
 * 这样落地的投掷物会自然进入淡出。重新移动则立刻恢复显示。
 */
export const recordTrailPoint = ({
  id,
  side,
  position,
  visible,
}: {
  id: string
  side: Side | null
  position: [number, number]
  visible: boolean
}): void => {
  let trail = grenadeTrails[id]

  if (!trail) {
    trail = {
      id,
      side,
      points: [],
      removedLength: 0,
      visible,
      stoppedAt: null,
      idleFrames: 0,
    }
    grenadeTrails[id] = trail
  }

  trail.side = side
  trail.visible = visible

  const last = trail.points[trail.points.length - 1]
  const hasMoved =
    last === undefined ||
    Math.hypot(last[0] - position[0], last[1] - position[1]) >= TRAIL_MIN_MOVE_PX

  if (!hasMoved) return

  trail.points.push([position[0], position[1]])
  trail.stoppedAt = null
  trail.idleFrames = 0
  trailFrameTouched.add(id)

  if (trail.points.length > TRAIL_MAX_POINTS) {
    const removed = trail.points.splice(0, trail.points.length - TRAIL_MAX_POINTS)
    const head = trail.points[0]

    // 累计被裁掉那段的长度：虚线相位要靠它补回来，否则首点一挪图案就整条滑动
    if (head) {
      let previous: [number, number] = head

      for (let index = removed.length - 1; index >= 0; index -= 1) {
        const point = removed[index]!

        trail.removedLength += Math.hypot(previous[0] - point[0], previous[1] - point[1])
        previous = point
      }
    }
  }
}

export const extendGrenade = ({
  grenade,
  mapName,
  side,
}: {
  grenade: Grenade
  side: Side | null
  mapName: string
}): RadarGrenadeObject[] | null => {
  const extGrenade: ExtendedGrenade = {
    ...grenade,
    side,
  }

  const safeMaps = maps as Record<string, MapConfig>
  const map = safeMaps[mapName]

  if (!map) return null

  /**
   * inferno 特殊处理：
   * 它本身没有 position，只有一组火焰点位，无法作为单个投掷物点位渲染，
   * 统一交给 extendFire 产出火焰区域多边形。
   */
  if (extGrenade.type === 'inferno') return null

  const state = getRadarGrenadeState(extGrenade)

  if ('config' in map) {
    const position = parseGrenadePosition(extGrenade, map.config)

    if (!position) return null

    const grenadeObject: RadarGrenadeObject = {
      ...extGrenade,
      position,
      state,
      visible: true,
    }

    recordTrailPoint({
      id: grenadeObject.id,
      side: extGrenade.side,
      position: [position[0] ?? 0, position[1] ?? 0],
      visible: true,
    })

    return [grenadeObject]
  }

  return map.configs.flatMap((config) => {
    const position = parseGrenadePosition(extGrenade, config.config)

    if (!position) return []

    const grenadeObject: RadarGrenadeObject = {
      ...extGrenade,
      id: `${extGrenade.id}_${config.id}`,
      position,
      state,
      visible: config.isVisible(extGrenade.position[2] ?? 0),
    }

    recordTrailPoint({
      id: grenadeObject.id,
      side: extGrenade.side,
      position: [position[0] ?? 0, position[1] ?? 0],
      visible: grenadeObject.visible,
    })

    return [grenadeObject]
  })
}

/**
 * 把 inferno 展开成「每个图层一个火焰区域对象」。
 *
 * 覆盖半径在游戏坐标系里推导一次，再按各图层自己的 pxPerUX / pxPerUY 换算，
 * 保证不同地图缩放下的火团大小都与真实燃烧范围一致。
 */
export const extendFire = ({
  grenade,
  mapName,
}: {
  grenade: InfernoGrenade
  mapName: string
}): RadarFireObject[] | null => {
  const safeMaps = maps as Record<string, MapConfig>
  const map = safeMaps[mapName]

  if (!map) return null

  const flameRadius = deriveFlameRadius(grenade.flames.map((flame) => flame.position))

  const toFireObject = (
    id: string,
    flames: InfernoGrenade['flames'],
    scale: ScaleConfig,
  ): RadarFireObject => {
    const cells = flames.map((flame) => parsePosition(flame.position, scale))

    return {
      id,
      cells,
      radius: (flameRadius * (Math.abs(scale.pxPerUX) + Math.abs(scale.pxPerUY))) / 2,
      visible: cells.length > 0,
    }
  }

  if ('config' in map) {
    return [toFireObject(grenade.id, grenade.flames, map.config)]
  }

  return map.configs.map((config) =>
    toFireObject(
      `${grenade.id}_${config.id}`,
      grenade.flames.filter((flame) => config.isVisible(flame.position[2] ?? 0)),
      config.config,
    ),
  )
}

export const updateDeadLocations = (currentPlayers: Player[]): void => {
  for (const player of currentPlayers) {
    const isAlive = player.state.health > 0

    if (isAlive) {
      if (deadLocations[player.steamid]) {
        delete deadLocations[player.steamid]
      }
    } else {
      if (!deadLocations[player.steamid]) {
        const lastFramePlayer = playersStates[1]?.find((p) => p.steamid === player.steamid)

        if (lastFramePlayer && lastFramePlayer.state.health > 0) {
          deadLocations[player.steamid] = lastFramePlayer.position
        } else {
          deadLocations[player.steamid] = player.position
        }
      }
    }
  }
}

export const extendPlayer = ({
  player,
  mapName,
}: {
  player: Player
  mapName: string
}): RadarPlayerObject[] | null => {
  const weapon = getShootingWeapon(player)

  const currentShooting: ShootingState = {
    ammo: weapon?.ammo_clip ?? 0,
    weapon: weapon?.name ?? '',
    lastShoot: 0,
  }

  const previousShooting = shootingState[player.steamid] || currentShooting

  let isShooting = false

  if (
    currentShooting.weapon &&
    currentShooting.weapon === previousShooting.weapon &&
    currentShooting.ammo < previousShooting.ammo
  ) {
    isShooting = true
  }

  currentShooting.lastShoot = isShooting ? Date.now() : previousShooting.lastShoot
  shootingState[player.steamid] = currentShooting

  const safeMaps = maps as Record<string, MapConfig>
  const map = safeMaps[mapName]

  if (!map) return null

  const isAlive = player.state.health > 0

  const basePlayer: RadarPlayerObject = {
    ...player,
    id: player.steamid,
    side: player.team.side,
    position: [0, 0, 0],
    visible: true,
    isActive: Boolean(player.isFocused),
    isAlive,
    hasBomb: Boolean(player.isBomb),
    isFlashed: player.state.flashed > 35,
    isShooting,
    lastShoot: currentShooting.lastShoot,
    scale: 1,
  }

  if ('config' in map) {
    const scale =
      map.config.originHeight === undefined
        ? 1
        : 1 + ((player.position[2] ?? 0) - map.config.originHeight) / 1000

    let position: [number, number, number]

    if (!isAlive && deadLocations[player.steamid]) {
      const deadPos = deadLocations[player.steamid] ?? [0, 0, 0]
      const pos = parsePosition(deadPos, map.config)
      position = [pos[0], pos[1], 0]
    } else {
      position = parsePlayerPosition(player, map.config)
    }

    return [
      {
        ...basePlayer,
        position,
        scale,
      },
    ]
  }

  return map.configs.map((config) => {
    const scale =
      config.config.originHeight === undefined
        ? 1
        : 1 + ((player.position[2] ?? 0) - config.config.originHeight) / 750

    let visible = config.isVisible(player.position[2] ?? 0)

    let position: [number, number, number]

    if (!isAlive && deadLocations[player.steamid]) {
      const deadPos = deadLocations[player.steamid] ?? [0, 0, 0]
      const pos = parsePosition(deadPos, config.config)

      position = [pos[0], pos[1], 0]
      visible = config.isVisible(deadPos[2] ?? 0)
    } else {
      position = parsePlayerPosition(player, config.config)
    }

    const layeredPlayer: RadarPlayerObject = {
      ...basePlayer,
      id: `${player.steamid}_${config.id}`,
      position,
      visible,
      scale,
    }

    return layeredPlayer
  })
}

export const resetStates = (): void => {
  playersStates.length = 0
  grenadesStates.length = 0

  for (const key in directions) delete directions[key]
  for (const key in explosionPlaces) delete explosionPlaces[key]
  for (const key in shootingState) delete shootingState[key]
  for (const key in deadLocations) delete deadLocations[key]

  clearTrails()
  trailFrameKey = null
  clearFires()
}
