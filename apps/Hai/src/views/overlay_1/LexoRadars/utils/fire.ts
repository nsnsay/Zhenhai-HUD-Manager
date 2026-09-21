/**
 * 雷达火焰区域的几何与形变。
 *
 * inferno 在 GSI 里只有一组零散的火点坐标，没有现成轮廓。这里负责取它们的凸包、
 * 按推导出的半径向外扩张成一块圆角多边形，并在数据变化时按顶点做形状插值，
 * 使火势蔓延是平滑过渡而不是跳变。
 *
 * 与 playersStates / grenadeTrails 一样，形变状态放在模块级 store 里；
 * 几何与插值函数都是纯函数，方便单测。
 */
import type { RadarFireObject } from './interface'

/** 一次形变的时长（毫秒）。 */
export const FIRE_MORPH_MS = 260

/** 每个环重采样后的顶点数，两帧之间顶点数一致才好插值。 */
export const FIRE_OUTLINE_SAMPLES = 48

/** 覆盖半径 = 火点最近邻距离中位数 × 该倍率。 */
export const FIRE_RADIUS_FACTOR = 0.7

/** 推导不出火点间距时的兜底半径（游戏单位）。 */
export const FIRE_RADIUS_UNITS_FALLBACK = 32

/** 推导出的半径下限与上限（游戏单位）。 */
export const FIRE_RADIUS_UNITS_MIN = 8
export const FIRE_RADIUS_UNITS_MAX = 200

/** 单点火点的圆、以及胶囊端帽的采样段数（端帽用其中一半）。 */
export const FIRE_CIRCLE_SEGMENTS = 16

/** 圆角外扩时每个转角的采样角度步长与最大段数。 */
export const FIRE_CORNER_ANGLE_STEP = Math.PI / 12
export const FIRE_CORNER_MAX_STEPS = 12

/** Chaikin 平滑次数，一次用于抹平圆弧采样带来的折线感。 */
export const FIRE_SMOOTHING_PASSES = 1

/** 闭合环，顶点按顺序排列，不重复首点。 */
export type FireRing = [number, number][]

type FireRingMorph = {
  from: FireRing
  to: FireRing
  startedAt: number
}

type FireMorphState = {
  id: string
  visible: boolean
  /** 火点集合与半径的指纹，只有它变了才需要重算目标轮廓。 */
  signature: string
  rings: FireRingMorph[]
  /** 火区已从数据里消失，形变结束后删除。 */
  dying: boolean
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const clamp01 = (value: number): number => clamp(value, 0, 1)

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

/**
 * 火点坐标是零散的（实测间距在个位数到几十之间乱跳），所以不再假设规则网格，
 * 而是统计每个火点到最近邻的距离、取中位数，再乘倍率当作每团火的覆盖半径。
 */
export const deriveFlameRadius = (positions: number[][]): number => {
  if (positions.length < 2) return FIRE_RADIUS_UNITS_FALLBACK

  const nearest: number[] = []

  for (let index = 0; index < positions.length; index += 1) {
    const point = positions[index]!
    let distance = Number.POSITIVE_INFINITY

    for (let other = 0; other < positions.length; other += 1) {
      if (other === index) continue

      const candidate = positions[other]!

      distance = Math.min(
        distance,
        Math.hypot((point[0] ?? 0) - (candidate[0] ?? 0), (point[1] ?? 0) - (candidate[1] ?? 0)),
      )
    }

    if (Number.isFinite(distance)) nearest.push(distance)
  }

  if (nearest.length === 0) return FIRE_RADIUS_UNITS_FALLBACK

  const sorted = [...nearest].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? FIRE_RADIUS_UNITS_FALLBACK

  return clamp(median * FIRE_RADIUS_FACTOR, FIRE_RADIUS_UNITS_MIN, FIRE_RADIUS_UNITS_MAX)
}

const pointsSignature = (points: [number, number][]): string =>
  points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

/**
 * 凸包（Andrew 单调链）。
 *
 * 去重并按 x/y 排序后分别构建下链与上链，共线点只留端点。
 * 退化情形（不足三点或全部共线）返回去重排序后的点，交给调用方按胶囊处理。
 */
export const convexHull = (points: [number, number][]): FireRing => {
  const unique = [
    ...new Map(points.map((point) => [`${point[0]},${point[1]}`, point])).values(),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1])

  if (unique.length <= 2) return unique

  const turn = (o: [number, number], a: [number, number], b: [number, number]): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const build = (source: FireRing): FireRing => {
    const chain: FireRing = []

    for (const point of source) {
      while (
        chain.length >= 2 &&
        turn(chain[chain.length - 2]!, chain[chain.length - 1]!, point) <= 0
      ) {
        chain.pop()
      }

      chain.push(point)
    }

    return chain
  }

  const lower = build(unique)
  const upper = build([...unique].reverse())
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)]

  return hull.length >= 3 ? hull : unique
}

/** 统一成面积为正的绕向，方便后续对齐与插值。 */
const withPositiveArea = (ring: FireRing): FireRing =>
  ringArea(ring) < 0 ? [...ring].reverse() : ring

/** 单点火点用的圆。 */
const circleRing = (
  center: [number, number],
  radius: number,
  segments: number = FIRE_CIRCLE_SEGMENTS,
): FireRing =>
  Array.from(
    { length: segments },
    (_, index) =>
      [
        center[0] + Math.cos((index / segments) * Math.PI * 2) * radius,
        center[1] + Math.sin((index / segments) * Math.PI * 2) * radius,
      ] as [number, number],
  )

/** 两点或共线火点退化成胶囊形（线段与圆盘的 Minkowski 和）。 */
const capsuleRing = (from: [number, number], to: [number, number], radius: number): FireRing => {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dx, dy)

  if (length <= 0) return circleRing(from, radius)

  const nx = -dy / length
  const ny = dx / length
  const startAngle = Math.atan2(ny, nx)
  const half = Math.max(2, Math.round(FIRE_CIRCLE_SEGMENTS / 2))
  const ring: FireRing = [
    [from[0] + nx * radius, from[1] + ny * radius],
    [to[0] + nx * radius, to[1] + ny * radius],
  ]

  for (let step = 1; step < half; step += 1) {
    const angle = startAngle - (Math.PI * step) / half

    ring.push([to[0] + Math.cos(angle) * radius, to[1] + Math.sin(angle) * radius])
  }

  ring.push(
    [to[0] - nx * radius, to[1] - ny * radius],
    [from[0] - nx * radius, from[1] - ny * radius],
  )

  for (let step = 1; step < half; step += 1) {
    const angle = startAngle + Math.PI - (Math.PI * step) / half

    ring.push([from[0] + Math.cos(angle) * radius, from[1] + Math.sin(angle) * radius])
  }

  return ring
}

const farthestPair = (points: FireRing): [[number, number], [number, number]] => {
  let best: [[number, number], [number, number]] = [points[0]!, points[1] ?? points[0]!]
  let bestDistance = -1

  for (let index = 0; index < points.length; index += 1) {
    for (let other = index + 1; other < points.length; other += 1) {
      const a = points[index]!
      const b = points[other]!
      const distance = Math.hypot(b[0] - a[0], b[1] - a[1])

      if (distance > bestDistance) {
        bestDistance = distance
        best = [a, b]
      }
    }
  }

  return best
}

/**
 * 把凸包按半径向外扩张成圆角多边形：每条边平移 radius，
 * 相邻偏移线之间用绕凸包顶点的圆弧连接，等价于凸包与圆盘的 Minkowski 和。
 */
const offsetRing = (hull: FireRing, radius: number): FireRing => {
  const ring = ringArea(hull) < 0 ? [...hull].reverse() : hull
  const count = ring.length
  const offsets: {
    start: [number, number]
    end: [number, number]
    normal: [number, number]
    corner: [number, number]
  }[] = []

  for (let index = 0; index < count; index += 1) {
    const from = ring[index]!
    const to = ring[(index + 1) % count]!
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const length = Math.hypot(dx, dy)

    if (length <= 0) continue

    // 正面积绕向下，外法线是 (dy, -dx)
    const normal: [number, number] = [dy / length, -dx / length]

    offsets.push({
      start: [from[0] + normal[0] * radius, from[1] + normal[1] * radius],
      end: [to[0] + normal[0] * radius, to[1] + normal[1] * radius],
      normal,
      corner: to,
    })
  }

  if (offsets.length < 3) return []

  const result: FireRing = []

  for (let index = 0; index < offsets.length; index += 1) {
    const current = offsets[index]!
    const next = offsets[(index + 1) % offsets.length]!

    result.push(current.start, current.end)

    const startAngle = Math.atan2(current.normal[1], current.normal[0])
    let sweep = Math.atan2(next.normal[1], next.normal[0]) - startAngle

    while (sweep <= 0) sweep += Math.PI * 2
    while (sweep > Math.PI * 2) sweep -= Math.PI * 2

    const steps = Math.min(
      FIRE_CORNER_MAX_STEPS,
      Math.max(2, Math.ceil(sweep / FIRE_CORNER_ANGLE_STEP)),
    )

    for (let step = 1; step < steps; step += 1) {
      const angle = startAngle + (sweep * step) / steps

      result.push([
        current.corner[0] + Math.cos(angle) * radius,
        current.corner[1] + Math.sin(angle) * radius,
      ])
    }
  }

  return result
}

/**
 * 火区轮廓：取火点凸包后按半径向外扩张。
 *
 * 单点退化成圆，两点或共线退化成胶囊，其余是圆角凸多边形，
 * 因此永远不会出现孤立碎片或断裂的小点。
 */
export const traceFlameOutline = (points: [number, number][], radius: number): FireRing[] => {
  if (points.length === 0 || radius <= 0) return []

  const hull = convexHull(points)

  if (hull.length === 0) return []

  let ring: FireRing

  if (hull.length === 1) {
    ring = circleRing(hull[0]!, radius)
  } else if (hull.length === 2 || Math.abs(ringArea(hull)) <= 1e-6) {
    const [from, to] = farthestPair(hull)

    ring = capsuleRing(from, to, radius)
  } else {
    ring = offsetRing(hull, radius)
  }

  return ring.length >= 3 ? [withPositiveArea(ring)] : []
}

/** 按弧长把环重采样成固定顶点数，首点保持不动，便于两帧之间一一对应。 */
export const resampleRing = (ring: FireRing, count: number): FireRing => {
  const head = ring[0]

  if (!head || count <= 0) return []
  if (ring.length === 1) return Array.from({ length: count }, () => [head[0], head[1]])

  const lengths: number[] = []
  let perimeter = 0

  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index]!
    const b = ring[(index + 1) % ring.length]!
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])

    lengths.push(length)
    perimeter += length
  }

  if (perimeter <= 0) return Array.from({ length: count }, () => [head[0], head[1]])

  const result: FireRing = []
  let segment = 0
  let walked = 0

  for (let index = 0; index < count; index += 1) {
    const target = (perimeter * index) / count

    while (segment < ring.length - 1 && walked + lengths[segment]! < target) {
      walked += lengths[segment]!
      segment += 1
    }

    const length = lengths[segment]!
    const ratio = length > 0 ? (target - walked) / length : 0
    const a = ring[segment]!
    const b = ring[(segment + 1) % ring.length]!

    result.push([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio])
  }

  return result
}

/** 有向面积，用来判断绕向。 */
export const ringArea = (ring: FireRing): number => {
  let sum = 0

  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index]!
    const b = ring[(index + 1) % ring.length]!

    sum += a[0] * b[1] - b[0] * a[1]
  }

  return sum / 2
}

export const ringCentroid = (ring: FireRing): [number, number] => {
  if (ring.length === 0) return [0, 0]

  let x = 0
  let y = 0

  for (const point of ring) {
    x += point[0]
    y += point[1]
  }

  return [x / ring.length, y / ring.length]
}

/**
 * 把目标环对齐到起始环：统一绕向，再旋转起点让总位移最小，
 * 否则插值过程中多边形会自己扭起来。
 */
export const alignRing = (from: FireRing, to: FireRing): FireRing => {
  if (from.length === 0 || to.length === 0) return to

  const target = from.length === to.length ? [...to] : resampleRing(to, from.length)

  if (ringArea(from) * ringArea(target) < 0) target.reverse()

  let best = target
  let bestScore = Number.POSITIVE_INFINITY

  for (let shift = 0; shift < target.length; shift += 1) {
    let score = 0

    for (let index = 0; index < from.length; index += 1) {
      const a = from[index]!
      const b = target[(index + shift) % target.length]!

      score += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
    }

    if (score < bestScore) {
      bestScore = score
      best = target.map((_, index) => target[(index + shift) % target.length]!)
    }
  }

  return best
}

export const morphRing = (from: FireRing, to: FireRing, t: number): FireRing => {
  const count = Math.min(from.length, to.length)
  const result: FireRing = []

  for (let index = 0; index < count; index += 1) {
    const a = from[index]!
    const b = to[index]!

    result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }

  return result
}

/** 所有顶点收到质心，用于火区出现（展开）与熄灭（收缩）。 */
export const collapseRing = (ring: FireRing): FireRing => {
  const [x, y] = ringCentroid(ring)

  return ring.map(() => [x, y])
}

/** Chaikin 细分，把直角轮廓磨圆。 */
export const smoothRing = (ring: FireRing, passes: number = FIRE_SMOOTHING_PASSES): FireRing => {
  let current = ring

  for (let pass = 0; pass < passes; pass += 1) {
    if (current.length < 3) return current

    const next: FireRing = []

    for (let index = 0; index < current.length; index += 1) {
      const a = current[index]!
      const b = current[(index + 1) % current.length]!

      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }

    current = next
  }

  return current
}

/**
 * 火区形变状态，按火区 id 索引（多层地图带图层后缀）。
 */
export const fireMorphs: Record<string, FireMorphState> = {}

const fireSignature = (fire: RadarFireObject): string =>
  `${fire.radius.toFixed(3)}|${pointsSignature(fire.cells)}`

const morphProgress = (morph: FireRingMorph, now: number): number =>
  FIRE_MORPH_MS <= 0 ? 1 : clamp01((now - morph.startedAt) / FIRE_MORPH_MS)

const displayedRing = (morph: FireRingMorph, now: number): FireRing => {
  const progress = morphProgress(morph, now)

  // 端点直接返回，避免 from + (to - from) * 1 带来的浮点误差
  if (progress <= 0) return morph.from
  if (progress >= 1) return morph.to

  return morphRing(morph.from, morph.to, easeOutCubic(progress))
}

/**
 * 把目标环逐个配到上一帧的环上：就近复用，多的收缩、新的展开，
 * 于是分叉、合并、孔洞开合都能平滑过渡。
 */
const matchRings = (previous: FireRing[], targets: FireRing[], now: number): FireRingMorph[] => {
  const taken = new Set<number>()
  const morphed: FireRingMorph[] = []

  for (const target of targets) {
    const centroid = ringCentroid(target)
    let matchIndex = -1
    let matchDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < previous.length; index += 1) {
      if (taken.has(index)) continue

      const candidate = ringCentroid(previous[index]!)
      const distance = Math.hypot(candidate[0] - centroid[0], candidate[1] - centroid[1])

      if (distance < matchDistance) {
        matchDistance = distance
        matchIndex = index
      }
    }

    if (matchIndex >= 0) {
      taken.add(matchIndex)

      const from = previous[matchIndex]!

      morphed.push({ from, to: alignRing(from, target), startedAt: now })
      continue
    }

    morphed.push({ from: collapseRing(target), to: target, startedAt: now })
  }

  for (let index = 0; index < previous.length; index += 1) {
    if (taken.has(index)) continue

    const from = previous[index]!

    morphed.push({ from, to: collapseRing(from), startedAt: now })
  }

  return morphed
}

const isAnimating = (now: number): boolean =>
  Object.values(fireMorphs).some((state) =>
    state.rings.some((morph) => morphProgress(morph, now) < 1),
  )

/**
 * 同步本帧的火区目标。
 *
 * 只有格子集合真的变了才重算轮廓，并把「当前插值结果」作为新的起点，
 * 因此动画中途来新数据也不会跳变。返回是否还有形变在进行中。
 */
export const syncFireTargets = (fires: RadarFireObject[], now: number = Date.now()): boolean => {
  const seen = new Set<string>()

  for (const fire of fires) {
    seen.add(fire.id)

    const signature = fireSignature(fire)
    const state = fireMorphs[fire.id]

    if (state && state.signature === signature) {
      state.visible = fire.visible
      state.dying = false
      continue
    }

    const targets = traceFlameOutline(fire.cells, fire.radius)
      .map((ring) => resampleRing(ring, FIRE_OUTLINE_SAMPLES))
      .filter((ring) => ring.length === FIRE_OUTLINE_SAMPLES)
    const previous = state?.rings.map((morph) => displayedRing(morph, now)) ?? []

    fireMorphs[fire.id] = {
      id: fire.id,
      visible: fire.visible,
      signature,
      rings: matchRings(previous, targets, now),
      dying: false,
    }
  }

  for (const [id, state] of Object.entries(fireMorphs)) {
    if (seen.has(id)) continue

    // 火熄灭：顶点收缩到质心，动画结束后由 advanceFireMorphs 删除
    if (!state.dying) {
      state.rings = state.rings.map((morph) => ({
        from: displayedRing(morph, now),
        to: collapseRing(morph.to),
        startedAt: now,
      }))
      state.dying = true
    }

    if (state.rings.length === 0) delete fireMorphs[id]
  }

  return isAnimating(now)
}

/** 推进一步形变：返回是否还需要继续（false 时组件可以停掉 rAF）。 */
export const advanceFireMorphs = (now: number = Date.now()): boolean => {
  let animating = false

  for (const [id, state] of Object.entries(fireMorphs)) {
    if (state.rings.some((morph) => morphProgress(morph, now) < 1)) {
      animating = true
      continue
    }

    if (state.dying) {
      delete fireMorphs[id]
      continue
    }

    // 形变结束后把起点收敛到终点，后续再变化就直接从这里开始
    state.rings = state.rings.map((morph) => ({ from: morph.to, to: morph.to, startedAt: now }))
  }

  return animating
}

export type FireRingSet = {
  id: string
  visible: boolean
  rings: FireRing[]
}

/** 当前要渲染的火焰环，供画布渲染器直接消费。 */
export const getFireRings = (now: number = Date.now()): FireRingSet[] => {
  const sets: FireRingSet[] = []

  for (const state of Object.values(fireMorphs)) {
    const rings = state.rings
      .map((morph) => smoothRing(displayedRing(morph, now)))
      .filter((ring) => ring.length >= 3)

    if (rings.length === 0) continue

    sets.push({ id: state.id, visible: state.visible, rings })
  }

  return sets
}

export const clearFires = (): void => {
  for (const id in fireMorphs) delete fireMorphs[id]
}
