/**
 * 雷达画布的纯逻辑：投影、贴图摆放、插值、状态计时与绘制顺序。
 *
 * 这里完全不碰 Canvas API，全部是可以在单测里直接验证的计算；
 * 真正的绘制在 RadarCanvas.vue。
 */
import type { RadarGrenadeObject, RadarPlayerObject } from '../utils/interface'

/** 雷达内部坐标系边长，与地图配置、点位坐标一致。 */
export const RADAR_SIZE = 1024

/** 位置 / 朝向 / 缩放 / 显隐的插值时长，对齐原来 CSS 过渡的手感。 */
export const MOTION_POSITION_MS = 100
export const MOTION_YAW_MS = 200
export const MOTION_SCALE_MS = 500
export const MOTION_ALPHA_MS = 500

/** 开枪指示保持可见的时长，与原实现一致。 */
export const SHOOT_WINDOW_MS = 250

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

/** CSS `background-size: contain` 的等价计算：完整放进盒子后的贴图尺寸。 */
export const containSize = (
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } => {
  if (imageWidth <= 0 || imageHeight <= 0) return { width: boxWidth, height: boxHeight }

  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight)

  return { width: imageWidth * scale, height: imageHeight * scale }
}

/** 玩家标记尖角顶点到圆心的距离（相对半径）。 */
export const PLAYER_NOSE_TIP_RATIO = 1.55

/**
 * 局部朝 +x 的形状（方向箭头、开枪虚线）要对上玩家朝向需要旋转的角度。
 *
 * 雷达的 yaw 约定是 0 朝北（屏幕上方、-y）、90 朝东（+x），
 * 所以局部 +x 要先减 90 度才对得上。
 */
export const headingRotation = (yaw: number): number => yaw - 90

/**
 * 玩家标记的几何：半径 radius 的圆，前方接一个尖角。
 *
 * 尖角的两条边是从顶点引向圆的切线，因此圆与尖角的外轮廓是连续的一条线，
 * 不会出现「圆 + 贴上去的三角」那种拼缝。局部坐标朝 +x，
 * 经 headingRotation 旋转后正好指向玩家朝向（与开枪虚线同一套约定）。
 */
export type PlayerMarkerGeometry = {
  /** 尖角顶点。 */
  tip: [number, number]
  /** 圆上的两个切点（+θ 与 -θ）。 */
  tangentA: [number, number]
  tangentB: [number, number]
  /** 切点相对 +x 的夹角（弧度），决定尖角有多尖。 */
  tangentAngle: number
}

export const playerMarkerGeometry = (radius: number): PlayerMarkerGeometry => {
  const tipDistance = radius * PLAYER_NOSE_TIP_RATIO
  const tangentAngle = Math.acos(Math.min(1, Math.max(-1, radius / tipDistance)))
  const x = radius * Math.cos(tangentAngle)
  const y = radius * Math.sin(tangentAngle)

  return {
    tip: [tipDistance, 0],
    tangentA: [x, y],
    tangentB: [x, -y],
    tangentAngle,
  }
}

/** 玩家标记右上角徽标的位置与大小（相对半径）。 */
export const PLAYER_BADGE_OFFSET_RATIO = 0.8
export const PLAYER_BADGE_SIZE_RATIO = 0.95

/**
 * 携带物徽标（C4 / 拆弹器）：压在标记右上角，
 * 圆心正好落在圆的 45° 边缘上，一半压在标记里、一半露在外面。
 */
export const playerBadgeRect = (radius: number): { x: number; y: number; size: number } => ({
  x: radius * PLAYER_BADGE_OFFSET_RATIO,
  y: -radius * PLAYER_BADGE_OFFSET_RATIO,
  size: radius * PLAYER_BADGE_SIZE_RATIO,
})

export type SmokeBump = {
  x: number
  y: number
  radius: number
}

/**
 * 烟雾云朵的凸起（相对烟雾半径，坐标原点在云朵中心）。
 *
 * 四个圆依次搭在一起、中间那个更大，并集的外轮廓就是一朵简笔画云。
 */
export const SMOKE_CLOUD_BUMPS: SmokeBump[] = [
  { x: -0.58, y: 0.18, radius: 0.4 },
  { x: -0.16, y: -0.12, radius: 0.54 },
  { x: 0.3, y: -0.04, radius: 0.44 },
  { x: 0.6, y: 0.22, radius: 0.34 },
]

/** 云朵蠕动：一个循环的时长，以及漂移/呼吸的幅度（相对半径）。 */
export const SMOKE_WOBBLE_PERIOD_MS = 3200
/*
 * 幅度是按「屏幕上看得见」定的：雷达默认 420 显示尺寸时，
 * 1 个 1024 空间的像素约等于 0.41 屏幕像素，所以漂移要到 0.12R 左右才看得出来。
 */
export const SMOKE_WOBBLE_DRIFT_X = 0.12
export const SMOKE_WOBBLE_DRIFT_Y = 0.09
export const SMOKE_WOBBLE_BREATH = 0.11

/**
 * 带蠕动的云朵凸起。
 *
 * 每个凸起按自己的相位做小幅漂移，同时半径轻轻呼吸，合起来就是云在慢慢揉动的感觉。
 * 所有相位都按同一周期推进（只有整数倍频率），因此循环无缝、看起来一直在动而不是跳一下。
 */
export const smokeCloudBumps = (radius: number, timeMs = 0, phaseOffset = 0): SmokeBump[] =>
  SMOKE_CLOUD_BUMPS.map((bump, index) => {
    const phase =
      (timeMs / SMOKE_WOBBLE_PERIOD_MS) * Math.PI * 2 +
      (index * Math.PI * 2) / SMOKE_CLOUD_BUMPS.length +
      phaseOffset

    return {
      x: (bump.x + Math.sin(phase) * SMOKE_WOBBLE_DRIFT_X) * radius,
      y: (bump.y + Math.cos(phase) * SMOKE_WOBBLE_DRIFT_Y) * radius,
      radius: bump.radius * (1 + Math.sin(phase + Math.PI / 3) * SMOKE_WOBBLE_BREATH) * radius,
    }
  })

/** 由道具 id 派生稳定的相位偏移，让同时存在的多个烟雾各揉各的、不会整齐划一。 */
export const smokePhaseOffset = (id: string): number => {
  let hash = 0

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997
  }

  return (hash / 997) * Math.PI * 2
}

/** 烟雾散去：持续时长，以及散开时的放大比例。 */
export const SMOKE_DISSIPATE_MS = 1500
export const SMOKE_DISSIPATE_GROW = 0.18

/**
 * 散去过程的透明度与放大倍数。
 *
 * 烟雾在 GSI 里进入最后一个相位（`exploded`，即冒完开始消散）时开始计时，
 * 一边变淡一边略微胀开，看起来就是烟散掉而不是「啪」地消失。
 */
export const smokeDissipate = (elapsedMs: number): { alpha: number; scale: number } => {
  const progress = clamp01(elapsedMs / SMOKE_DISSIPATE_MS)

  return {
    alpha: 1 - progress,
    scale: 1 + SMOKE_DISSIPATE_GROW * progress,
  }
}

/** 一次性爆炸/拆除特效的时长、最大半径与颜色。 */
export type RadarEffectStyle = {
  duration: number
  spread: number
  color: string
}

export const RADAR_EFFECT_STYLES = {
  /** 手雷炸开：短促一圈。 */
  blast: { duration: 420, spread: 60, color: 'rgba(255, 236, 210, 0.85)' },
  /** C4 爆炸。 */
  explode: { duration: 1200, spread: 150, color: 'rgb(225, 45, 35)' },
  /** C4 被拆除。 */
  defuse: { duration: 1200, spread: 150, color: 'rgb(45, 205, 75)' },
} as const satisfies Record<string, RadarEffectStyle>

export type RadarEffectKind = keyof typeof RADAR_EFFECT_STYLES

export type RadarEffect = RadarEffectStyle & {
  id: string
  x: number
  y: number
  startedAt: number
}

/**
 * 一次性特效，按 id 去重。
 *
 * 「观察到状态」和「实体消失兜底」两条触发路径共用同一个 id，
 * 因此同一颗道具只会播一次，不会重复闪两下。
 */
export const radarEffects: Record<string, RadarEffect> = {}

/**
 * 已经触发过特效的 id。
 *
 * 特效播完会从 radarEffects 里删掉，但 id 要一直记到本回合结束：
 * 否则实体长时间停在 exploded 这类状态里时，每帧都会重新触发一次，看起来就是反复爆炸。
 */
export const firedEffects = new Set<string>()

export const pushEffect = (
  id: string,
  kind: RadarEffectKind,
  position: [number, number],
  now: number,
): boolean => {
  if (firedEffects.has(id)) return false

  const style = RADAR_EFFECT_STYLES[kind]

  firedEffects.add(id)
  radarEffects[id] = {
    id,
    x: position[0],
    y: position[1],
    startedAt: now,
    duration: style.duration,
    spread: style.spread,
    color: style.color,
  }

  return true
}

/** 圆环当前帧的半径与透明度；播完返回 null。 */
export const ringFrame = (
  effect: RadarEffect,
  now: number,
): { radius: number; alpha: number } | null => {
  if (effect.duration <= 0) return null

  const progress = (now - effect.startedAt) / effect.duration

  if (progress >= 1) return null

  const eased = easeOutCubic(clamp01(progress))

  return { radius: effect.spread * eased, alpha: 1 - clamp01(progress) }
}

export type RadarEffectFrame = {
  effect: RadarEffect
  radius: number
  alpha: number
}

/** 取当前还在播的特效，顺手清掉播完的。 */
export const getEffectFrames = (now: number): RadarEffectFrame[] => {
  const frames: RadarEffectFrame[] = []

  for (const [id, effect] of Object.entries(radarEffects)) {
    const frame = ringFrame(effect, now)

    if (!frame) {
      delete radarEffects[id]
      continue
    }

    frames.push({ effect, radius: frame.radius, alpha: frame.alpha })
  }

  return frames
}

export const hasActiveEffects = (now: number): boolean =>
  Object.values(radarEffects).some((effect) => ringFrame(effect, now) !== null)

export const clearEffects = (): void => {
  for (const id in radarEffects) delete radarEffects[id]

  firedEffects.clear()
}

export type GrenadeSnapshot = {
  id: string
  type: string
  x: number
  y: number
}

/** 上一帧还在场的道具，用来在实体直接从数据里消失时补一次爆炸特效。 */
export const grenadeSnapshots = new Map<string, GrenadeSnapshot>()

/**
 * 刷新道具快照，返回这一帧从数据里消失的道具（坐标取消失前最后已知的位置）。
 *
 * 上游只对 C4 派发 bombExplode / bombDefuse，手雷没有对应事件，
 * 所以手雷的爆炸要靠这条兜底路径。
 */
export const syncGrenadeSnapshots = (grenades: RadarGrenadeObject[]): GrenadeSnapshot[] => {
  const present = new Set<string>()

  for (const grenade of grenades) {
    present.add(grenade.id)
    grenadeSnapshots.set(grenade.id, {
      id: grenade.id,
      type: grenade.type,
      x: grenade.position[0] ?? 0,
      y: grenade.position[1] ?? 0,
    })
  }

  const vanished: GrenadeSnapshot[] = []

  for (const [id, snapshot] of grenadeSnapshots) {
    if (present.has(id)) continue

    vanished.push(snapshot)
    grenadeSnapshots.delete(id)
  }

  return vanished
}

export const clearGrenadeSnapshots = (): void => {
  grenadeSnapshots.clear()
}

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

/** 最短角差，结果落在 [-180, 180)。 */
export const shortestAngleDelta = (from: number, to: number): number =>
  ((((to - from) % 360) + 540) % 360) - 180

export const lerpAngle = (from: number, to: number, t: number): number =>
  from + shortestAngleDelta(from, to) * t

export const isShootingNow = (lastShoot: number, now: number): boolean =>
  now - lastShoot <= SHOOT_WINDOW_MS

/** 单条插值轨道：目标变化时记下起点与时刻，之后按 duration 缓出。 */
export type MotionTrack = {
  from: number
  to: number
  startedAt: number
  duration: number
  angle: boolean
}

export type EntityMotion = {
  x: MotionTrack
  y: MotionTrack
  yaw: MotionTrack
  scale: MotionTrack
  alpha: MotionTrack
}

export type MotionSample = {
  x: number
  y: number
  yaw: number
  scale: number
  alpha: number
}

export const trackProgress = (track: MotionTrack, now: number): number =>
  track.duration <= 0 ? 1 : clamp01((now - track.startedAt) / track.duration)

export const trackValue = (track: MotionTrack, now: number): number => {
  const progress = trackProgress(track, now)

  // 端点直接返回，避免 from + (to - from) * 1 带来的浮点误差
  if (progress <= 0) return track.from
  if (progress >= 1) return track.to

  const t = easeOutCubic(progress)

  return track.angle ? lerpAngle(track.from, track.to, t) : lerp(track.from, track.to, t)
}

const createTrack = (
  value: number,
  duration: number,
  angle: boolean,
  now: number,
): MotionTrack => ({
  from: value,
  to: value,
  startedAt: now,
  duration,
  angle,
})

const bindTrack = (track: MotionTrack, target: number, now: number): void => {
  if (track.to === target) return

  // 从当前插值结果续上，目标连续变化时不会跳变
  track.from = trackValue(track, now)
  track.to = target
  track.startedAt = now
}

/** 实体插值状态，与玩家 / 投掷物 / 炸弹的渲染一一对应。 */
export const entityMotions: Record<string, EntityMotion> = {}

/** 取该实体当前应绘制的位置、朝向、缩放与透明度，并把目标变化记成新的插值。 */
export const sampleMotion = (id: string, target: MotionSample, now: number): MotionSample => {
  let motion = entityMotions[id]

  if (!motion) {
    motion = {
      x: createTrack(target.x, MOTION_POSITION_MS, false, now),
      y: createTrack(target.y, MOTION_POSITION_MS, false, now),
      yaw: createTrack(target.yaw, MOTION_YAW_MS, true, now),
      scale: createTrack(target.scale, MOTION_SCALE_MS, false, now),
      alpha: createTrack(target.alpha, MOTION_ALPHA_MS, false, now),
    }
    entityMotions[id] = motion
  }

  bindTrack(motion.x, target.x, now)
  bindTrack(motion.y, target.y, now)
  bindTrack(motion.yaw, target.yaw, now)
  bindTrack(motion.scale, target.scale, now)
  bindTrack(motion.alpha, target.alpha, now)

  return {
    x: trackValue(motion.x, now),
    y: trackValue(motion.y, now),
    yaw: trackValue(motion.yaw, now),
    scale: trackValue(motion.scale, now),
    alpha: trackValue(motion.alpha, now),
  }
}

/** 是否还有未完成的插值（决定要不要继续跑帧）；目标没变过的轨道不算。 */
export const hasPendingMotion = (now: number): boolean =>
  Object.values(entityMotions).some((motion) =>
    Object.values(motion).some((track) => track.from !== track.to && trackProgress(track, now) < 1),
  )

export const pruneMotions = (activeIds: Set<string>): void => {
  for (const id of Object.keys(entityMotions)) {
    if (!activeIds.has(id)) delete entityMotions[id]
  }
}

/** 绘制层级：死亡在下、存活居中、当前聚焦最上（对齐原 z-index）。 */
export const playerLayer = (player: RadarPlayerObject): number =>
  !player.isAlive ? 1 : player.isActive ? 3 : 2

export const sortPlayersForDraw = (players: RadarPlayerObject[]): RadarPlayerObject[] =>
  [...players].sort((a, b) => playerLayer(a) - playerLayer(b))

/**
 * 状态起始时间：扩散环这类「状态切换后播一次」的动画需要知道切换时刻。
 * 每次看到同一个状态返回已经过的毫秒数，状态变化则重新计时。
 */
export const entityStateStamps: Record<string, { state: string; at: number }> = {}

export const stateElapsed = (id: string, state: string, now: number): number => {
  const stamp = entityStateStamps[id]

  if (!stamp || stamp.state !== state) {
    entityStateStamps[id] = { state, at: now }

    return 0
  }

  return now - stamp.at
}

export const pruneStateStamps = (activeIds: Set<string>): void => {
  for (const id of Object.keys(entityStateStamps)) {
    if (!activeIds.has(id)) delete entityStateStamps[id]
  }
}

/** 扩散环进度：循环的返回 0..1，一次性的播完返回 null。 */
export const expandProgress = (elapsed: number, duration: number, loop: boolean): number | null => {
  if (duration <= 0) return null

  if (loop) return (elapsed % duration) / duration

  const progress = elapsed / duration

  return progress >= 1 ? null : progress
}

/* ------------------------------------------------------------------ *
 * 自动取景（雷达相机）
 * ------------------------------------------------------------------ */

/** 自动放大的倍率上限。 */
export const RADAR_ZOOM_MAX = 2

/**
 * 自动取景的留白，单位是 1024 雷达坐标系里的像素。
 *
 * 包围盒每边额外留出的空隙，避免目标贴到画面边缘。本功能的观感调参点：
 * 调大 → 取景更保守（放大得更少），调小 → 更容易放大。
 */
export const RADAR_FOCUS_PADDING = 100

export interface RadarFocusOptions {
  padding?: number
  maxZoom?: number
}

/** 1024 雷达坐标系里的矩形包围盒。 */
export type RadarFocusBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type RadarFocusBox = {
  /** 画面中心（1024 雷达坐标系）。 */
  origin: [number, number]
  /** 1 = 全景，上限为 maxZoom。 */
  zoom: number
  /** 已加留白的包围盒，供相机平滑时做包含性夹取。 */
  bounds: RadarFocusBounds
}

/**
 * 由关注点算出自动取景的中心与倍率。
 *
 * 把包围盒每边扩出 padding 后整体放进 RADAR_SIZE 的画面，取横竖两个方向所需倍率中
 * 较小的那个（保证两个方向都装得下），再夹到 [1, maxZoom]。
 *
 * 返回 null 表示没有关注点：调用方应保持当前取景，而不是跳回全景。
 */
export const radarFocusBox = (
  points: readonly (readonly [number, number])[],
  options: RadarFocusOptions = {},
): RadarFocusBox | null => {
  if (points.length === 0) return null

  const padding = options.padding ?? RADAR_FOCUS_PADDING
  const maxZoom = options.maxZoom ?? RADAR_ZOOM_MAX

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const spanX = maxX - minX + padding * 2
  const spanY = maxY - minY + padding * 2
  const fit = Math.min(RADAR_SIZE / spanX, RADAR_SIZE / spanY)

  return {
    origin: [(minX + maxX) / 2, (minY + maxY) / 2],
    zoom: Math.min(maxZoom, Math.max(1, fit)),
    bounds: {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    },
  }
}

/** 把值夹进 [min, max]；区间本身为空（min > max）时退回区间中点。 */
const clampIntoRange = (value: number, min: number, max: number): number =>
  min > max ? (min + max) / 2 : Math.min(max, Math.max(min, value))

/**
 * 把当前相机夹回「一定装得下 bounds」的范围。
 *
 * 平滑会让相机中心滞后于目标、倍率也可能已经先缩下去；视野变小而中心还在半路时，
 * 聚在地图角落的选手就会被切到画面外。这里做两件事：
 *
 * 1. 倍率不得高于「刚好装下带留白的包围盒」所需的值，即视野不小于包围盒；
 * 2. 中心夹到「包围盒仍完整可见」的区间里（贴边到极限时退回包围盒中心）。
 *
 * 注意 `fit` 下限取 1：整图已经是最大的视野，不再往外缩。
 */
export const containFocusView = (
  view: { origin: readonly [number, number]; zoom: number },
  bounds: RadarFocusBounds,
): { origin: [number, number]; zoom: number } => {
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY

  const fit = Math.max(
    1,
    Math.min(
      spanX > 0 ? RADAR_SIZE / spanX : Infinity,
      spanY > 0 ? RADAR_SIZE / spanY : Infinity,
    ),
  )

  const zoom = Math.min(view.zoom, fit)
  const half = RADAR_SIZE / (2 * zoom)

  return {
    zoom,
    origin: [
      clampIntoRange(view.origin[0], bounds.maxX - half, bounds.minX + half),
      clampIntoRange(view.origin[1], bounds.maxY - half, bounds.minY + half),
    ],
  }
}

/** 从 `useHaiSettings().teamColor(side)` 的变量字典里取颜色，缺失时回退。 */
export const colorFromVars = (
  vars: Record<string, string> | undefined,
  key: string,
  fallback: string,
): string => vars?.[key] ?? fallback
