import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FIRE_MORPH_MS,
  FIRE_OUTLINE_SAMPLES,
  FIRE_RADIUS_FACTOR,
  FIRE_RADIUS_UNITS_FALLBACK,
  FIRE_RADIUS_UNITS_MAX,
  FIRE_RADIUS_UNITS_MIN,
  advanceFireMorphs,
  alignRing,
  clearFires,
  convexHull,
  deriveFlameRadius,
  fireMorphs,
  getFireRings,
  morphRing,
  resampleRing,
  ringArea,
  syncFireTargets,
  traceFlameOutline,
  type FireRing,
} from '../fire'
import type { RadarFireObject } from '../interface'

const NOW = 1_000_000
const RADIUS = 8

const fire = (id: string, points: [number, number][], radius = RADIUS): RadarFireObject => ({
  id,
  cells: points,
  radius,
  visible: points.length > 0,
})

const boundsOf = (points: [number, number][]) => {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)

  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

const centerOf = (points: [number, number][]): [number, number] => {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)

  return [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]
}

const uniqueVertices = (ring: [number, number][]): number =>
  new Set(ring.map((point) => `${point[0]},${point[1]}`)).size

const perimeterOf = (ring: FireRing): number => {
  let total = 0

  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index]!
    const b = ring[(index + 1) % ring.length]!

    total += Math.hypot(b[0] - a[0], b[1] - a[1])
  }

  return total
}

/** 射线法判断点是否在多边形内部。 */
const isInside = (ring: FireRing, [x, y]: [number, number]): boolean => {
  let inside = false

  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index]!
    const b = ring[(index + 1) % ring.length]!

    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside
    }
  }

  return inside
}

beforeEach(() => {
  clearFires()
})

afterEach(() => {
  clearFires()
})

describe('火点半径推导', () => {
  it('只有一个火点时回退到默认半径', () => {
    expect(deriveFlameRadius([[0, 0, 0]])).toBe(FIRE_RADIUS_UNITS_FALLBACK)
  })

  it('按最近邻距离的中位数乘以倍率', () => {
    expect(
      deriveFlameRadius([
        [0, 0, 0],
        [100, 0, 0],
      ]),
    ).toBe(100 * FIRE_RADIUS_FACTOR)

    const grid = [
      [0, 0, 0],
      [100, 0, 0],
      [0, 100, 0],
      [100, 100, 0],
    ]

    expect(deriveFlameRadius(grid)).toBe(100 * FIRE_RADIUS_FACTOR)
  })

  it('过小与过大的间距都会被钳制', () => {
    expect(
      deriveFlameRadius([
        [0, 0, 0],
        [4, 0, 0],
      ]),
    ).toBe(FIRE_RADIUS_UNITS_MIN)
    expect(
      deriveFlameRadius([
        [0, 0, 0],
        [5000, 0, 0],
      ]),
    ).toBe(FIRE_RADIUS_UNITS_MAX)
  })
})

describe('凸包', () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]

  it('只保留角点，内部点与共线点都不进结果', () => {
    const hull = convexHull([...square, [5, 5], [5, 0]])

    expect(hull).toHaveLength(4)
    expect(ringArea(hull)).toBeGreaterThan(0)
    for (const point of square) {
      expect(hull).toContainEqual(point)
    }
  })

  it('输入顺序不影响结果', () => {
    const shuffled: [number, number][] = [
      [10, 10],
      [0, 0],
      [10, 0],
      [0, 10],
    ]

    expect(convexHull(shuffled)).toEqual(convexHull(square))
  })

  it('共线点退化成一条线', () => {
    expect(
      convexHull([
        [0, 0],
        [10, 0],
        [20, 0],
      ]),
    ).toHaveLength(3)
  })
})

describe('火区轮廓', () => {
  it('单个火点得到一个半径大小的圆', () => {
    const ring = traceFlameOutline([[0, 0]], RADIUS)[0]!

    expect(boundsOf(ring)).toEqual({ width: RADIUS * 2, height: RADIUS * 2 })

    // 正十六边形面积略小于同半径的圆
    const circleArea = Math.PI * RADIUS * RADIUS

    expect(ringArea(ring)).toBeGreaterThan(circleArea * 0.9)
    expect(ringArea(ring)).toBeLessThan(circleArea)
  })

  it('两个火点退化成胶囊形', () => {
    const ring = traceFlameOutline(
      [
        [0, 0],
        [40, 0],
      ],
      RADIUS,
    )[0]!

    expect(boundsOf(ring)).toEqual({ width: 40 + RADIUS * 2, height: RADIUS * 2 })
  })

  it('三角火区按半径外扩，原火点全部落在多边形内部', () => {
    const points: [number, number][] = [
      [0, 0],
      [40, 0],
      [20, 30],
    ]
    const ring = traceFlameOutline(points, RADIUS)[0]!
    const bounds = boundsOf(ring)

    // 圆角是按角度采样的，极值点没被采到时包围盒会比理想外扩量小一点点（远小于一个屏幕像素）
    expect(bounds.width).toBeGreaterThan(40 + RADIUS * 2 - 0.2)
    expect(bounds.width).toBeLessThanOrEqual(40 + RADIUS * 2)
    expect(bounds.height).toBeGreaterThan(30 + RADIUS * 2 - 0.2)
    expect(bounds.height).toBeLessThanOrEqual(30 + RADIUS * 2)

    for (const point of points) {
      expect(isInside(ring, point)).toBe(true)
    }
  })

  it('打乱与反向输入得到同一条轮廓', () => {
    const points: [number, number][] = [
      [0, 0],
      [40, 0],
      [20, 30],
      [30, 10],
    ]
    const reordered = [points[2]!, points[0]!, points[3]!, points[1]!]

    expect(traceFlameOutline(reordered, RADIUS)).toEqual(traceFlameOutline(points, RADIUS))
  })

  it('分散的火点也是一整块，不会碎成多个点', () => {
    const ring = traceFlameOutline(
      [
        [0, 0],
        [20, 12],
        [3, 25],
        [18, 20],
        [1, 8],
      ],
      RADIUS,
    )

    expect(ring).toHaveLength(1)
  })

  it('没有火点或半径非法时没有轮廓', () => {
    expect(traceFlameOutline([], RADIUS)).toEqual([])
    expect(traceFlameOutline([[0, 0]], 0)).toEqual([])
  })
})

describe('重采样、对齐与插值', () => {
  const square: FireRing = [
    [0, 0],
    [40, 0],
    [40, 40],
    [0, 40],
  ]

  it('重采样后顶点数固定、首点不变、周长守恒', () => {
    const resampled = resampleRing(square, FIRE_OUTLINE_SAMPLES)

    expect(resampled).toHaveLength(FIRE_OUTLINE_SAMPLES)
    expect(resampled[0]).toEqual([0, 0])
    expect(perimeterOf(resampled)).toBeCloseTo(perimeterOf(square), 5)
  })

  it('旋转与反向的等价环都能对齐回原环', () => {
    const rotated: FireRing = [...square.slice(2), ...square.slice(0, 2)]
    const reversed: FireRing = [...square].reverse()

    expect(alignRing(square, rotated)).toEqual(square)
    expect(alignRing(square, reversed)).toEqual(square)
  })

  it('插值在两端取到起终点、中间取中点', () => {
    const target: FireRing = square.map(([x, y]) => [x + 20, y + 20])

    expect(morphRing(square, target, 0)).toEqual(square)
    expect(morphRing(square, target, 1)).toEqual(target)
    expect(morphRing(square, target, 0.5)[0]).toEqual([10, 10])
  })
})

describe('火焰形变', () => {
  const block: [number, number][] = [
    [0, 0],
    [32, 0],
    [0, 32],
    [32, 32],
  ]

  it('新火区从质心展开到目标轮廓，外扩量与中心都对得上', () => {
    expect(syncFireTargets([fire('f1', block)], NOW)).toBe(true)

    // 刚开始时所有顶点都压在质心上
    expect(uniqueVertices(getFireRings(NOW)[0]!.rings[0]!)).toBe(1)

    const settled = getFireRings(NOW + FIRE_MORPH_MS)[0]!.rings[0]!

    expect(boundsOf(settled)).toEqual({ width: 32 + RADIUS * 2, height: 32 + RADIUS * 2 })
    expect(centerOf(settled)).toEqual([16, 16])
  })

  it('形变结束后不再需要动画帧', () => {
    syncFireTargets([fire('f1', block)], NOW)

    expect(advanceFireMorphs(NOW + FIRE_MORPH_MS / 2)).toBe(true)
    expect(advanceFireMorphs(NOW + FIRE_MORPH_MS)).toBe(false)
  })

  it('形变中途换目标时从当前形状接着走，不跳变', () => {
    const mid = NOW + FIRE_MORPH_MS / 2

    syncFireTargets([fire('f1', block)], NOW)

    const before = getFireRings(mid)[0]!.rings

    syncFireTargets([fire('f1', [...block, [64, 16]])], mid)

    expect(getFireRings(mid)[0]!.rings).toEqual(before)
  })

  it('火熄灭时收缩到质心，形变结束后清除状态', () => {
    syncFireTargets([fire('f1', block)], NOW)
    advanceFireMorphs(NOW + FIRE_MORPH_MS)

    syncFireTargets([], NOW + FIRE_MORPH_MS)

    expect(fireMorphs.f1?.dying).toBe(true)

    // 收缩过程中仍在出图，且所有顶点最终汇到一点
    expect(uniqueVertices(getFireRings(NOW + FIRE_MORPH_MS * 2)[0]!.rings[0]!)).toBe(1)
    expect(advanceFireMorphs(NOW + FIRE_MORPH_MS * 2)).toBe(false)
    expect(fireMorphs.f1).toBeUndefined()
  })

  it('火点没变时不会重置形变', () => {
    syncFireTargets([fire('f1', block)], NOW)
    advanceFireMorphs(NOW + FIRE_MORPH_MS)

    const settled = fireMorphs.f1?.rings[0]?.to

    syncFireTargets([fire('f1', block)], NOW + FIRE_MORPH_MS * 4)

    expect(fireMorphs.f1?.rings[0]?.to).toBe(settled)
  })

  it('clearFires 清空全部火区状态', () => {
    syncFireTargets([fire('f1', block), fire('f2', block)], NOW)

    clearFires()

    expect(fireMorphs).toEqual({})
    expect(getFireRings(NOW)).toEqual([])
  })
})
