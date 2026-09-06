// oxlint-disable-next-line no-unused-vars
import type { Grenade, InfernoGrenade, Player, Side, Weapon } from '@zhenhai/csgogsi/types'
import maps, { type MapConfig, type ScaleConfig } from './maps'
import type {
  ExtendedGrenade,
  RadarGrenadeObject,
  RadarGrenadeState,
  RadarPlayerObject,
} from './interface'

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
   * 原始 inferno 本身没有 position，而是火焰点位集合。
   * 这里将每一个火焰点位转换成一个可渲染的 RadarGrenadeObject。
   */
  if (extGrenade.type === 'inferno') {
    const flameObjects: RadarGrenadeObject[] = []

    if ('config' in map) {
      for (const flame of extGrenade.flames) {
        const position = parsePosition(flame.position, map.config)

        flameObjects.push({
          ...extGrenade,
          flames: [],
          id: `${flame.id}_${extGrenade.id}`,
          position,
          state: 'landed',
          visible: true,
        })
      }

      return flameObjects
    }

    for (const flame of extGrenade.flames) {
      for (const config of map.configs) {
        const position = parsePosition(flame.position, config.config)

        flameObjects.push({
          ...extGrenade,
          flames: [],
          id: `${flame.id}_${extGrenade.id}_${config.id}`,
          position,
          state: 'landed',
          visible: config.isVisible(flame.position[2] ?? 0),
        })
      }
    }

    return flameObjects
  }

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

    return [grenadeObject]
  })
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
}
