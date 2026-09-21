import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TRAIL_FADE_MS,
  TRAIL_MAX_POINTS,
  TRAIL_PRUNE_SLACK_MS,
  beginTrailFrame,
  clearTrails,
  getTrailRenderablesNumeric,
  grenadeTrails,
  pruneTrails,
  recordTrailPoint,
  resetStates,
} from '../utils'
import type { RadarTrail } from '../interface'

const START_TIME = new Date('2026-01-01T00:00:00.000Z').getTime()

function trail(id: string): RadarTrail {
  const value = grenadeTrails[id]

  if (!value) {
    throw new Error(`trail ${id} 不存在`)
  }

  return value
}

function push(
  id: string,
  position: [number, number],
  { side = 'CT', visible = true }: { side?: 'CT' | 'T'; visible?: boolean } = {},
): void {
  recordTrailPoint({ id, side, position, visible })
}

/** 模拟一个数据包：开始新帧并记下投掷物当前的位置。 */
function packet(
  id: string,
  position: [number, number] | null,
  { side = 'CT', visible = true }: { side?: 'CT' | 'T'; visible?: boolean } = {},
): object {
  const frame = {}

  beginTrailFrame(frame)

  if (position) {
    push(id, position, { side, visible })
  }

  return frame
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START_TIME)
  clearTrails()
})

afterEach(() => {
  clearTrails()
  vi.useRealTimers()
})

describe('轨迹点采集', () => {
  it('只有一个点时不可渲染，补上第二个点后才出现轨迹', () => {
    push('g1', [100, 100])

    expect(trail('g1').points).toHaveLength(1)
    expect(getTrailRenderablesNumeric()).toHaveLength(0)

    push('g1', [110, 100])

    expect(getTrailRenderablesNumeric()).toHaveLength(1)
    expect(trail('g1').points).toEqual([
      [100, 100],
      [110, 100],
    ])
  })

  it('位移小于阈值时不算移动，达到阈值才追加', () => {
    push('g1', [100, 100])
    push('g1', [100.2, 100.1])

    expect(trail('g1').points).toHaveLength(1)

    push('g1', [100.5, 100])

    expect(trail('g1').points).toHaveLength(2)
  })

  it('位置不变时仍然刷新 side 与图层可见性', () => {
    push('g1', [100, 100])
    push('g1', [100, 100], { side: 'T', visible: false })

    expect(trail('g1').points).toHaveLength(1)
    expect(trail('g1').side).toBe('T')
    expect(trail('g1').visible).toBe(false)
  })

  it('同一份数据重复求值不会重复记点', () => {
    const frame = packet('g1', [100, 100])

    push('g1', [110, 100])
    beginTrailFrame(frame)
    push('g1', [110, 100])

    expect(trail('g1').points).toHaveLength(2)
  })

  it(`点数超过 ${TRAIL_MAX_POINTS} 时丢弃最旧的点`, () => {
    const total = TRAIL_MAX_POINTS + 10

    for (let index = 0; index < total; index += 1) {
      push('g1', [index * 10, 0])
    }

    const points = trail('g1').points

    expect(points).toHaveLength(TRAIL_MAX_POINTS)
    expect(points[0]).toEqual([100, 0])
  })
})

describe('虚线相位', () => {
  const STEP = 10

  it('没有裁剪时相位为 0', () => {
    push('g1', [100, 100])
    push('g1', [100 + STEP, 100])

    expect(trail('g1').removedLength).toBe(0)
    expect(getTrailRenderablesNumeric()[0]?.dashOffset).toBe(0)
  })

  it('超出点数上限后累计被裁掉的长度，并随继续移动继续累加', () => {
    const extra = 5

    for (let index = 0; index < TRAIL_MAX_POINTS + extra; index += 1) {
      push('g1', [index * STEP, 0])
    }

    expect(trail('g1').points).toHaveLength(TRAIL_MAX_POINTS)
    expect(trail('g1').removedLength).toBeCloseTo(extra * STEP, 6)
    expect(getTrailRenderablesNumeric()[0]?.dashOffset).toBeCloseTo(extra * STEP, 6)

    for (let index = TRAIL_MAX_POINTS + extra; index < TRAIL_MAX_POINTS + extra + 10; index += 1) {
      push('g1', [index * STEP, 0])
    }

    expect(trail('g1').removedLength).toBeCloseTo((extra + 10) * STEP, 6)
  })
})

describe('停止判定与淡出', () => {
  it('连续两个数据包没有新点才判定停止', () => {
    packet('g1', [100, 100])
    packet('g1', [110, 100])

    beginTrailFrame({})
    expect(trail('g1').stoppedAt).toBeNull()

    beginTrailFrame({})
    expect(trail('g1').stoppedAt).toBeNull()

    beginTrailFrame({})
    expect(trail('g1').stoppedAt).toBe(START_TIME)
  })

  it('投掷物从数据里消失后同样进入淡出', () => {
    packet('g1', [100, 100])
    packet('g1', [110, 100])
    packet('g1', null)
    packet('g1', null)

    beginTrailFrame({})

    expect(trail('g1').stoppedAt).toBe(START_TIME)
    expect(getTrailRenderablesNumeric()).toHaveLength(1)
  })

  it('同一数据对象重复开始新帧是幂等的', () => {
    packet('g1', [100, 100])
    packet('g1', [110, 100])

    const idleFrame = {}

    beginTrailFrame(idleFrame)
    beginTrailFrame(idleFrame)
    beginTrailFrame(idleFrame)

    // 重复求值不应该累积空闲帧，否则会把仍在飞的道具误判成停止
    expect(trail('g1').idleFrames).toBe(0)
    expect(trail('g1').stoppedAt).toBeNull()
  })

  it('再次移动会立刻恢复显示', () => {
    packet('g1', [100, 100])
    packet('g1', [110, 100])
    beginTrailFrame({})
    beginTrailFrame({})
    beginTrailFrame({})

    expect(trail('g1').stoppedAt).not.toBeNull()

    push('g1', [200, 200])

    expect(trail('g1').stoppedAt).toBeNull()
    expect(trail('g1').idleFrames).toBe(0)
    expect(trail('g1').points).toHaveLength(3)
  })

  it('淡出走完之前不删除，走完之后才清理', () => {
    packet('g1', [100, 100])
    packet('g1', [110, 100])
    beginTrailFrame({})
    beginTrailFrame({})
    beginTrailFrame({})

    pruneTrails(START_TIME + TRAIL_FADE_MS + TRAIL_PRUNE_SLACK_MS)
    expect(getTrailRenderablesNumeric()).toHaveLength(1)

    pruneTrails(START_TIME + TRAIL_FADE_MS + TRAIL_PRUNE_SLACK_MS + 1)
    expect(grenadeTrails.g1).toBeUndefined()
  })

  it('仍在生长的轨迹不会被清理', () => {
    packet('g1', [100, 100])
    packet('g1', [110, 100])

    pruneTrails(START_TIME + TRAIL_FADE_MS * 10)

    expect(getTrailRenderablesNumeric()).toHaveLength(1)
  })
})

describe('图层隔离与清理', () => {
  it('多层地图按 id 各自的轨迹独立生长', () => {
    beginTrailFrame({})
    push('g1_high', [100, 100])
    push('g1_low', [300, 300], { side: 'T', visible: false })

    beginTrailFrame({})
    push('g1_high', [140, 100])
    push('g1_low', [340, 300], { side: 'T', visible: false })

    beginTrailFrame({})
    push('g1_high', [180, 100])

    beginTrailFrame({})
    push('g1_high', [220, 100])

    beginTrailFrame({})

    expect(Object.keys(grenadeTrails)).toHaveLength(2)
    expect(trail('g1_high').stoppedAt).toBeNull()
    expect(trail('g1_low').stoppedAt).not.toBeNull()
    expect(trail('g1_low').visible).toBe(false)
    expect(trail('g1_high').points).toHaveLength(4)
    expect(trail('g1_low').points).toHaveLength(2)
    expect(
      getTrailRenderablesNumeric()
        .map((item) => item.id)
        .sort(),
    ).toEqual(['g1_high', 'g1_low'])
  })

  it('clearTrails 清空全部轨迹', () => {
    packet('g1', [100, 100])
    packet('g1', [110, 100])

    clearTrails()

    expect(grenadeTrails).toEqual({})
    expect(getTrailRenderablesNumeric()).toHaveLength(0)
  })

  it('resetStates 一并清空轨迹与帧状态', () => {
    const stale = {}

    packet('g1', [100, 100])
    packet('g1', [110, 100])
    beginTrailFrame(stale)

    resetStates()

    expect(grenadeTrails).toEqual({})

    // 清空后同一个数据对象仍然被当作新的一帧处理
    beginTrailFrame(stale)
    push('g2', [10, 10])

    expect(trail('g2').points).toHaveLength(1)
  })
})
