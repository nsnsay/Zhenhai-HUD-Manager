import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MOTION_POSITION_MS,
  SHOOT_WINDOW_MS,
  colorFromVars,
  containSize,
  entityMotions,
  entityStateStamps,
  expandProgress,
  getEffectFrames,
  hasPendingMotion,
  hasActiveEffects,
  headingRotation,
  isShootingNow,
  PLAYER_NOSE_TIP_RATIO,
  playerBadgeRect,
  playerMarkerGeometry,
  playerLayer,
  pushEffect,
  pruneMotions,
  pruneStateStamps,
  RADAR_EFFECT_STYLES,
  radarEffects,
  ringFrame,
  sampleMotion,
  shortestAngleDelta,
  lerpAngle,
  SMOKE_CLOUD_BUMPS,
  SMOKE_WOBBLE_BREATH,
  SMOKE_WOBBLE_DRIFT_X,
  SMOKE_WOBBLE_DRIFT_Y,
  SMOKE_WOBBLE_PERIOD_MS,
  smokeCloudBumps,
  smokeDissipate,
  smokePhaseOffset,
  SMOKE_DISSIPATE_GROW,
  SMOKE_DISSIPATE_MS,
  sortPlayersForDraw,
  stateElapsed,
  syncGrenadeSnapshots,
  clearEffects,
  clearGrenadeSnapshots,
  containFocusView,
  RADAR_FOCUS_PADDING,
  RADAR_SIZE,
  RADAR_ZOOM_MAX,
  radarFocusBox,
} from '../scene'
import type { RadarGrenadeObject, RadarPlayerObject } from '../../utils/interface'

const NOW = 1_000_000

const playerOf = (id: string, isAlive: boolean, isActive: boolean): RadarPlayerObject =>
  ({ id, isAlive, isActive }) as unknown as RadarPlayerObject

const baseSample = { x: 0, y: 0, yaw: 0, scale: 1, alpha: 1 }

beforeEach(() => {
  pruneMotions(new Set())
  pruneStateStamps(new Set())
  clearEffects()
  clearGrenadeSnapshots()
})

afterEach(() => {
  pruneMotions(new Set())
  pruneStateStamps(new Set())
  clearEffects()
  clearGrenadeSnapshots()
})

describe('投掷物贴图摆放', () => {
  it('contain 会完整放进盒子并保持比例', () => {
    // 投掷物图标：169 × 51 的图放进 30 × 30 的盒子
    const size = containSize(169, 51, 30, 30)

    expect(size.width).toBeCloseTo(30, 6)
    expect(size.height).toBeCloseTo((51 / 169) * 30, 6)
  })

  it('尺寸非法时退回盒子尺寸', () => {
    expect(containSize(0, 10, 30, 30)).toEqual({ width: 30, height: 30 })
  })
})

describe('玩家标记（圆 + 尖角）', () => {
  const RADIUS = 32.5

  const rotate = (point: [number, number], degrees: number): [number, number] => {
    const rad = (degrees * Math.PI) / 180

    return [
      point[0] * Math.cos(rad) - point[1] * Math.sin(rad),
      point[0] * Math.sin(rad) + point[1] * Math.cos(rad),
    ]
  }

  it('尖角顶点在圆外，两个切点正好落在圆上', () => {
    const { tip, tangentA, tangentB, tangentAngle } = playerMarkerGeometry(RADIUS)

    expect(tip[0]).toBeCloseTo(RADIUS * PLAYER_NOSE_TIP_RATIO, 6)
    expect(tip[1]).toBe(0)
    expect(Math.hypot(tangentA[0], tangentA[1])).toBeCloseTo(RADIUS, 6)
    expect(Math.hypot(tangentB[0], tangentB[1])).toBeCloseTo(RADIUS, 6)
    expect(tangentAngle).toBeCloseTo(Math.acos(1 / PLAYER_NOSE_TIP_RATIO), 6)
    // 尖角是个往前的锐角楔形，不是半圆
    expect(tangentAngle).toBeLessThan(Math.PI / 2)
  })

  it('切线与圆相切，圆到尖角的过渡是连续的', () => {
    const { tip, tangentA } = playerMarkerGeometry(RADIUS)
    const toTip = [tip[0] - tangentA[0], tip[1] - tangentA[1]]
    const radiusVector = [tangentA[0], tangentA[1]]

    // 切点处的半径与尖角边垂直，说明这条边确实是从顶点引出的切线
    expect(toTip[0]! * radiusVector[0]! + toTip[1]! * radiusVector[1]!).toBeCloseTo(0, 6)
  })

  it('关于朝向轴对称，且整体落在朝向正前方', () => {
    const { tip, tangentA, tangentB } = playerMarkerGeometry(RADIUS)

    expect(tangentA[0]).toBeCloseTo(tangentB[0], 6)
    expect(tangentA[1]).toBeCloseTo(-tangentB[1], 6)
    expect(tangentA[0]).toBeGreaterThan(0)
    expect(tip[0]).toBeGreaterThan(tangentA[0])
  })

  it('按 yaw 旋转后指向玩家朝向：yaw 0 朝北、90 朝东', () => {
    const { tip } = playerMarkerGeometry(RADIUS)

    // yaw 0 → 旋转 -90 度 → 屏幕上方（北）
    const north = rotate(tip, headingRotation(0))

    expect(north[0]).toBeCloseTo(0, 6)
    expect(north[1]).toBeCloseTo(-RADIUS * PLAYER_NOSE_TIP_RATIO, 6)

    // yaw 90 → 不旋转 → +x（东）
    const east = rotate(tip, headingRotation(90))

    expect(east[0]).toBeCloseTo(RADIUS * PLAYER_NOSE_TIP_RATIO, 6)
    expect(east[1]).toBeCloseTo(0, 6)
  })
})

describe('爆炸特效', () => {
  const grenadeOf = (id: string, type: string, x: number, y: number): RadarGrenadeObject =>
    ({ id, type, position: [x, y] }) as unknown as RadarGrenadeObject

  it('同一 id 只播一次，播完自动清理', () => {
    expect(pushEffect('blast:1', 'blast', [10, 20], NOW)).toBe(true)
    expect(pushEffect('blast:1', 'blast', [10, 20], NOW)).toBe(false)

    const frames = getEffectFrames(NOW)

    expect(frames).toHaveLength(1)
    expect(frames[0]!.effect.x).toBe(10)
    expect(frames[0]!.effect.y).toBe(20)
    expect(frames[0]!.radius).toBeCloseTo(0, 6)
    expect(hasActiveEffects(NOW)).toBe(true)

    expect(getEffectFrames(NOW + RADAR_EFFECT_STYLES.blast.duration)).toEqual([])
    expect(radarEffects).toEqual({})
    expect(hasActiveEffects(NOW + 1000)).toBe(false)
  })

  it('特效播完之后同一个 id 也不会再次触发', () => {
    expect(pushEffect('blast:1', 'blast', [10, 20], NOW)).toBe(true)

    // 播完被清理
    expect(getEffectFrames(NOW + RADAR_EFFECT_STYLES.blast.duration)).toEqual([])
    expect(radarEffects['blast:1']).toBeUndefined()

    // 实体还停在 exploded 状态里、每帧都会再推一次，但不能再播
    expect(pushEffect('blast:1', 'blast', [10, 20], NOW + 500)).toBe(false)
    expect(pushEffect('blast:1', 'blast', [10, 20], NOW + 900)).toBe(false)
    expect(hasActiveEffects(NOW + 900)).toBe(false)

    // 换回合清空后，新的道具可以重新触发
    clearEffects()

    expect(pushEffect('blast:1', 'blast', [10, 20], NOW + 1200)).toBe(true)
  })

  it('圆环随时间变大变淡，参数取自配置表', () => {
    pushEffect('bomb:explode', 'explode', [100, 120], NOW)

    const effect = radarEffects['bomb:explode']!

    expect(effect.spread).toBe(RADAR_EFFECT_STYLES.explode.spread)
    expect(effect.duration).toBe(RADAR_EFFECT_STYLES.explode.duration)
    expect(effect.color).toBe(RADAR_EFFECT_STYLES.explode.color)

    const start = ringFrame(effect, NOW)!
    const half = ringFrame(effect, NOW + effect.duration / 2)!
    const near = ringFrame(effect, NOW + effect.duration * 0.99)!

    expect(start.radius).toBeCloseTo(0, 6)
    expect(start.alpha).toBeCloseTo(1, 6)
    expect(half.radius).toBeGreaterThan(start.radius)
    expect(half.alpha).toBeLessThan(start.alpha)
    expect(near.radius).toBeGreaterThan(half.radius)
    expect(near.radius).toBeLessThanOrEqual(effect.spread)
    expect(ringFrame(effect, NOW + effect.duration)).toBeNull()
  })

  it('clearEffects 清空全部特效', () => {
    pushEffect('explode', 'explode', [0, 0], NOW)
    pushEffect('defuse', 'defuse', [0, 0], NOW)

    expect(Object.keys(radarEffects)).toHaveLength(2)

    clearEffects()

    expect(radarEffects).toEqual({})
  })

  it('消失兜底只报一次，且用消失前的最后坐标', () => {
    expect(syncGrenadeSnapshots([grenadeOf('g1', 'frag', 10, 10)])).toEqual([])
    expect(syncGrenadeSnapshots([grenadeOf('g1', 'frag', 30, 40)])).toEqual([])

    const vanished = syncGrenadeSnapshots([])

    expect(vanished).toEqual([{ id: 'g1', type: 'frag', x: 30, y: 40 }])
    // 已经报过，不会重复上报
    expect(syncGrenadeSnapshots([])).toEqual([])

    clearGrenadeSnapshots()
  })
})

describe('烟雾散去', () => {
  it('刚进入消散相位时完全可见、还没有胀开', () => {
    expect(smokeDissipate(0)).toEqual({ alpha: 1, scale: 1 })
  })

  it('结束时刚好淡到透明、并胀到设定比例', () => {
    const end = smokeDissipate(SMOKE_DISSIPATE_MS)

    expect(end.alpha).toBeCloseTo(0, 6)
    expect(end.scale).toBeCloseTo(1 + SMOKE_DISSIPATE_GROW, 6)
  })

  it('过程中单调变淡、单调胀开，超出时长后保持不变', () => {
    const quarter = smokeDissipate(SMOKE_DISSIPATE_MS / 4)
    const half = smokeDissipate(SMOKE_DISSIPATE_MS / 2)

    expect(quarter.alpha).toBeGreaterThan(half.alpha)
    expect(half.alpha).toBeGreaterThan(0)
    expect(quarter.scale).toBeLessThan(half.scale)
    expect(half.scale).toBeLessThan(smokeDissipate(SMOKE_DISSIPATE_MS).scale)

    expect(smokeDissipate(SMOKE_DISSIPATE_MS * 3)).toEqual({
      alpha: 0,
      scale: 1 + SMOKE_DISSIPATE_GROW,
    })
  })
})

describe('玩家携带物徽标', () => {
  const RADIUS = 32.5

  it('压在标记右上角，并跨在圆的边缘上', () => {
    const badge = playerBadgeRect(RADIUS)

    // 右上角：x 为正、y 为负，且关于 45° 对称
    expect(badge.x).toBeGreaterThan(0)
    expect(badge.y).toBeLessThan(0)
    expect(badge.x).toBeCloseTo(-badge.y, 6)

    // 圆心落在圆的 45° 外侧一点点，所以一半压在标记里、一半露在外面
    const distance = Math.hypot(badge.x, badge.y)

    expect(distance).toBeGreaterThan(RADIUS)
    expect(distance).toBeLessThan(RADIUS * 1.2)
  })

  it('大小随半径等比缩放', () => {
    expect(playerBadgeRect(RADIUS * 2).size).toBeCloseTo(playerBadgeRect(RADIUS).size * 2, 6)
    expect(playerBadgeRect(RADIUS).size).toBeGreaterThan(0)
  })
})

describe('烟雾云朵', () => {
  const RADIUS = 32.5
  const SAMPLE_TIMES = [
    0,
    SMOKE_WOBBLE_PERIOD_MS / 4,
    SMOKE_WOBBLE_PERIOD_MS / 2,
    SMOKE_WOBBLE_PERIOD_MS * 0.75,
  ]

  it('凸起按烟雾半径等比换算', () => {
    const single = smokeCloudBumps(RADIUS)
    const doubled = smokeCloudBumps(RADIUS * 2)

    expect(single).toHaveLength(SMOKE_CLOUD_BUMPS.length)

    single.forEach((bump, index) => {
      expect(doubled[index]!.x).toBeCloseTo(bump.x * 2, 6)
      expect(doubled[index]!.y).toBeCloseTo(bump.y * 2, 6)
      expect(doubled[index]!.radius).toBeCloseTo(bump.radius * 2, 6)
    })
  })

  it('相邻凸起互相重叠但谁也不吞掉谁，并集是一整朵云', () => {
    for (const time of SAMPLE_TIMES) {
      const bumps = smokeCloudBumps(RADIUS, time)

      for (let index = 1; index < bumps.length; index += 1) {
        const previous = bumps[index - 1]!
        const current = bumps[index]!
        const distance = Math.hypot(current.x - previous.x, current.y - previous.y)

        // 相交：距离小于半径和；但也不完全内含：距离大于半径差
        expect(distance).toBeLessThan(previous.radius + current.radius)
        expect(distance).toBeGreaterThan(Math.abs(previous.radius - current.radius))
      }
    }
  })

  it('比圆更宽、且蠕动时也始终落在烟雾范围内', () => {
    for (const time of SAMPLE_TIMES) {
      const bumps = smokeCloudBumps(RADIUS, time)
      const left = Math.min(...bumps.map((bump) => bump.x - bump.radius))
      const right = Math.max(...bumps.map((bump) => bump.x + bump.radius))
      const top = Math.min(...bumps.map((bump) => bump.y - bump.radius))
      const bottom = Math.max(...bumps.map((bump) => bump.y + bump.radius))

      expect(right - left).toBeGreaterThan(bottom - top)
      expect(left).toBeGreaterThan(-RADIUS * 1.25)
      expect(right).toBeLessThan(RADIUS * 1.25)
      expect(top).toBeGreaterThan(-RADIUS * 1.25)
      expect(bottom).toBeLessThan(RADIUS * 1.25)
    }
  })
})

describe('云朵蠕动', () => {
  const RADIUS = 32.5

  it('一个周期后回到同一形状，循环无缝', () => {
    const start = smokeCloudBumps(RADIUS, 0)
    const looped = smokeCloudBumps(RADIUS, SMOKE_WOBBLE_PERIOD_MS)

    looped.forEach((bump, index) => {
      expect(bump.x).toBeCloseTo(start[index]!.x, 6)
      expect(bump.y).toBeCloseTo(start[index]!.y, 6)
      expect(bump.radius).toBeCloseTo(start[index]!.radius, 6)
    })
  })

  it('形状确实在动，且漂移与呼吸都不超过设定幅度', () => {
    for (const time of [SMOKE_WOBBLE_PERIOD_MS / 4, SMOKE_WOBBLE_PERIOD_MS / 2]) {
      const moved = smokeCloudBumps(RADIUS, time)

      moved.forEach((bump, index) => {
        const base = SMOKE_CLOUD_BUMPS[index]!

        // 漂移：相对静态基准表的偏移不超过漂移幅度
        expect(Math.abs(bump.x - base.x * RADIUS)).toBeLessThanOrEqual(
          RADIUS * SMOKE_WOBBLE_DRIFT_X + 1e-6,
        )
        expect(Math.abs(bump.y - base.y * RADIUS)).toBeLessThanOrEqual(
          RADIUS * SMOKE_WOBBLE_DRIFT_Y + 1e-6,
        )

        // 呼吸：半径始终落在基准值的 ±BREATH 之内
        const baseRadius = base.radius * RADIUS

        expect(bump.radius).toBeGreaterThanOrEqual(baseRadius * (1 - SMOKE_WOBBLE_BREATH) - 1e-6)
        expect(bump.radius).toBeLessThanOrEqual(baseRadius * (1 + SMOKE_WOBBLE_BREATH) + 1e-6)
      })
    }

    // 至少有一个凸起真的挪动了，否则就是没在动
    const quarter = smokeCloudBumps(RADIUS, SMOKE_WOBBLE_PERIOD_MS / 4)

    expect(
      quarter.some((bump, index) => Math.abs(bump.x - SMOKE_CLOUD_BUMPS[index]!.x * RADIUS) > 0.01),
    ).toBe(true)
  })

  it('相位偏移由道具 id 决定：同一道具稳定、不同道具不同', () => {
    expect(smokePhaseOffset('24')).toBe(smokePhaseOffset('24'))
    expect(smokePhaseOffset('24')).not.toBe(smokePhaseOffset('25'))
    expect(smokePhaseOffset('24')).toBeGreaterThanOrEqual(0)
    expect(smokePhaseOffset('24')).toBeLessThan(Math.PI * 2)
  })
})

describe('角度与插值', () => {
  it('角度差走最短路径', () => {
    expect(shortestAngleDelta(350, 10)).toBeCloseTo(20, 6)
    expect(shortestAngleDelta(10, 350)).toBeCloseTo(-20, 6)
    expect(shortestAngleDelta(0, 90)).toBeCloseTo(90, 6)
  })

  it('角度插值跨过 360 度时不会绕远路', () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(360, 6)
    // 0 → 270 的最短方向是 -90，所以一半是 -45
    expect(lerpAngle(0, 270, 0.5)).toBeCloseTo(-45, 6)
  })

  it('新实体直接出现在目标位置，不会从原点滑入', () => {
    const sample = sampleMotion('p1', { ...baseSample, x: 400, y: 300 }, NOW)

    expect(sample.x).toBe(400)
    expect(sample.y).toBe(300)
    expect(hasPendingMotion(NOW)).toBe(false)
  })

  it('目标变化后按缓出插值到新位置', () => {
    sampleMotion('p1', baseSample, NOW)
    sampleMotion('p1', { ...baseSample, x: 100 }, NOW)

    // 刚变化时还在原点
    expect(sampleMotion('p1', { ...baseSample, x: 100 }, NOW).x).toBeCloseTo(0, 6)

    // 走到一半时长：缓出已经推进 87.5%
    const half = NOW + MOTION_POSITION_MS / 2
    const mid = sampleMotion('p1', { ...baseSample, x: 100 }, half)

    expect(mid.x).toBeCloseTo(87.5, 6)
    expect(hasPendingMotion(half)).toBe(true)

    // 时长走完就是目标值，且不再需要跑帧
    const settled = NOW + MOTION_POSITION_MS

    expect(sampleMotion('p1', { ...baseSample, x: 100 }, settled).x).toBeCloseTo(100, 6)
    expect(hasPendingMotion(settled)).toBe(false)
  })

  it('插值途中换目标时从当前值续上，不跳变', () => {
    sampleMotion('p1', baseSample, NOW)
    sampleMotion('p1', { ...baseSample, x: 100 }, NOW)

    const half = NOW + MOTION_POSITION_MS / 2
    const before = sampleMotion('p1', { ...baseSample, x: 100 }, half).x
    const after = sampleMotion('p1', { ...baseSample, x: 400 }, half).x

    expect(after).toBeCloseTo(before, 6)
  })

  it('清理后不再残留插值状态', () => {
    sampleMotion('p1', baseSample, NOW)

    expect(Object.keys(entityMotions)).toHaveLength(1)

    pruneMotions(new Set(['other']))

    expect(entityMotions).toEqual({})
  })
})

describe('绘制顺序', () => {
  it('死亡在下、存活居中、聚焦最上', () => {
    const alive = playerOf('alive', true, false)
    const dead = playerOf('dead', false, false)
    const focused = playerOf('focused', true, true)

    expect(playerLayer(dead)).toBe(1)
    expect(playerLayer(alive)).toBe(2)
    expect(playerLayer(focused)).toBe(3)
    expect(sortPlayersForDraw([focused, alive, dead]).map((p) => p.id)).toEqual([
      'dead',
      'alive',
      'focused',
    ])
  })
})

describe('状态计时', () => {
  it('第一次看到某状态从 0 开始计时，状态变化后重新计时', () => {
    expect(stateElapsed('g1', 'exploded', NOW)).toBe(0)
    expect(stateElapsed('g1', 'exploded', NOW + 120)).toBe(120)
    expect(stateElapsed('g1', 'exploded', NOW + 200)).toBe(200)
    expect(stateElapsed('g1', 'landed', NOW + 200)).toBe(0)
  })

  it('清理后不再残留状态时间', () => {
    stateElapsed('g1', 'exploded', NOW)

    expect(Object.keys(entityStateStamps)).toHaveLength(1)

    pruneStateStamps(new Set())

    expect(entityStateStamps).toEqual({})
  })

  it('循环扩散环按周期取模，一次性扩散环播完即结束', () => {
    expect(expandProgress(0, 2000, true)).toBe(0)
    expect(expandProgress(1000, 2000, true)).toBe(0.5)
    expect(expandProgress(2500, 2000, true)).toBeCloseTo(0.25, 6)

    expect(expandProgress(100, 250, false)).toBeCloseTo(0.4, 6)
    expect(expandProgress(250, 250, false)).toBeNull()
    expect(expandProgress(50, 0, true)).toBeNull()
  })
})

describe('颜色与开枪窗口', () => {
  it('队伍色字典缺失时回退到默认色', () => {
    const vars = { '--main-80': 'rgba(1, 2, 3, 0.8)' }

    expect(colorFromVars(vars, '--main-80', 'fallback')).toBe('rgba(1, 2, 3, 0.8)')
    expect(colorFromVars(vars, '--main-90', 'fallback')).toBe('fallback')
    expect(colorFromVars(undefined, '--main-90', 'fallback')).toBe('fallback')
  })

  it('开枪窗口只覆盖最近 250ms', () => {
    expect(isShootingNow(NOW - 100, NOW)).toBe(true)
    expect(isShootingNow(NOW - SHOOT_WINDOW_MS, NOW)).toBe(true)
    expect(isShootingNow(NOW - SHOOT_WINDOW_MS - 1, NOW)).toBe(false)
  })
})

describe('自动取景', () => {
  it('没有关注点时返回 null，调用方应保持当前取景', () => {
    expect(radarFocusBox([])).toBeNull()
  })

  it('单个点：夹到最大倍率，画面中心就是该点', () => {
    const box = radarFocusBox([[300, 400]])

    expect(box?.zoom).toBe(RADAR_ZOOM_MAX)
    expect(box?.origin).toEqual([300, 400])
  })

  it('两点相距 200：仍夹在最大倍率，中心取中点', () => {
    const box = radarFocusBox([
      [300, 400],
      [500, 400],
    ])

    expect(box?.zoom).toBe(RADAR_ZOOM_MAX)
    expect(box?.origin).toEqual([400, 400])
  })

  it('加留白后正好铺满全图时回到 1x', () => {
    const fullSpan = RADAR_SIZE - RADAR_FOCUS_PADDING * 2
    const box = radarFocusBox([
      [100, 512],
      [100 + fullSpan, 512],
    ])

    expect(box?.zoom).toBe(1)
    expect(box?.origin).toEqual([512, 512])
  })

  it('宽高不等时取较小的倍率，中心取包围盒中心', () => {
    const box = radarFocusBox([
      [0, 0],
      [800, 100],
    ])

    // 宽边 800 + 2×100 = 1000 → 1024/1000；高边只要 3.41x，取较小者
    expect(box?.zoom).toBeCloseTo(RADAR_SIZE / 1000, 6)
    expect(box?.origin).toEqual([400, 50])
  })

  it('留白与上限可覆盖', () => {
    const box = radarFocusBox(
      [
        [0, 0],
        [100, 0],
      ],
      { padding: 0, maxZoom: 3 },
    )

    expect(box?.zoom).toBe(3)
  })

  it('任意输入都落在 [1, 上限] 内', () => {
    const samples: [number, number][][] = [
      [[0, 0]],
      [
        [-5000, -5000],
        [5000, 5000],
      ],
      [
        [512, 512],
        [512, 512],
      ],
    ]

    for (const points of samples) {
      const box = radarFocusBox(points)

      expect(box).not.toBeNull()
      expect(box!.zoom).toBeGreaterThanOrEqual(1)
      expect(box!.zoom).toBeLessThanOrEqual(RADAR_ZOOM_MAX)
    }
  })
})

describe('相机包含性夹取', () => {
  it('倍率不会高于容纳包围盒所需的倍率', () => {
    const target = radarFocusBox([
      [200, 200],
      [600, 600],
    ])!

    // 相机已经缩到上限（视野 512），但带留白的包围盒是 600
    const view = containFocusView({ origin: [400, 400], zoom: RADAR_ZOOM_MAX }, target.bounds)

    expect(view.zoom).toBeLessThan(RADAR_ZOOM_MAX)
    expect(RADAR_SIZE / view.zoom).toBeGreaterThanOrEqual(600)
  })

  it('中心落在很远处时被夹回包围盒附近', () => {
    const target = radarFocusBox([
      [900, 900],
      [940, 940],
    ])!

    const view = containFocusView({ origin: [100, 100], zoom: RADAR_ZOOM_MAX }, target.bounds)
    const half = RADAR_SIZE / (2 * view.zoom)

    expect(view.origin[0]).toBeGreaterThanOrEqual(940 - half)
    expect(view.origin[1]).toBeGreaterThanOrEqual(940 - half)
  })

  it('单个点不做倍率夹取', () => {
    const target = radarFocusBox([[500, 500]])!
    const view = containFocusView({ origin: [0, 0], zoom: RADAR_ZOOM_MAX }, target.bounds)

    expect(view.zoom).toBe(RADAR_ZOOM_MAX)
  })

  it('包围盒比整图还大时退回包围盒中心、不再往外缩', () => {
    const target = radarFocusBox([
      [-100, -100],
      [1200, 1200],
    ])!

    const view = containFocusView({ origin: [-999, -999], zoom: RADAR_ZOOM_MAX }, target.bounds)

    expect(view.zoom).toBe(1)
    expect(view.origin).toEqual([550, 550])
  })

  it('回归：相机落后于角落聚集团时，关注点不会落到视野外', () => {
    const cases: [number, number][][] = [
      [
        [24, 24],
        [44, 44],
        [64, 24],
      ],
      [
        [1000, 1000],
        [1020, 1020],
        [1040, 1000],
      ],
      [
        [0, 512],
        [1024, 512],
      ],
      [[512, 512]],
    ]

    for (const points of cases) {
      const target = radarFocusBox(points)!
      // 最坏情况：中心停在目标的反方向，且倍率已经触顶
      const stale = {
        origin: [RADAR_SIZE - target.origin[0], RADAR_SIZE - target.origin[1]] as [number, number],
        zoom: RADAR_ZOOM_MAX,
      }
      const view = containFocusView(stale, target.bounds)
      const half = RADAR_SIZE / (2 * view.zoom)

      for (const [x, y] of points) {
        expect(Math.abs(x - view.origin[0])).toBeLessThanOrEqual(half + 1e-9)
        expect(Math.abs(y - view.origin[1])).toBeLessThanOrEqual(half + 1e-9)
      }
    }
  })
})
