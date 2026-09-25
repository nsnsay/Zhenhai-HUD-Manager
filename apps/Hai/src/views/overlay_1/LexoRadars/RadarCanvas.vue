<script setup lang="ts">
/**
 * 雷达的画布渲染器。
 *
 * 内部依旧使用 1024 坐标系，画布 backing store 按「显示尺寸 × devicePixelRatio」建立，
 * 因此不再需要先把 1024 的 DOM 层建出来再整体缩放。
 * 动画只在「有新数据 / 还有未完成的动画」时跑帧，空闲即停。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useGsiEvent } from '@zhenhai/csgogsi/gsi-vue'
import type { MapConfig } from './utils/maps'
import type {
  RadarBombObject,
  RadarFireObject,
  RadarGrenadeObject,
  RadarPlayerObject,
} from './utils/interface'
import config from './utils/config'
import { useHaiSettings } from '@/utils/useHaiSettings'
import { advanceFireMorphs, getFireRings, syncFireTargets } from './utils/fire'
import { TRAIL_DASH_PATTERN, TRAIL_STROKE_WIDTH, getTrailRenderablesNumeric } from './utils/utils'
import {
  BOMB_SPRITE,
  C4_SPRITE,
  DEFUSER_SPRITE,
  getImage,
  grenadeSprite,
  onAssetsUpdated,
  preloadSprites,
} from './canvas/assets'
import {
  RADAR_SIZE,
  RADAR_EFFECT_STYLES,
  clamp01,
  colorFromVars,
  containSize,
  expandProgress,
  getEffectFrames,
  hasPendingMotion,
  hasActiveEffects,
  headingRotation,
  isShootingNow,
  playerBadgeRect,
  playerMarkerGeometry,
  pruneMotions,
  pruneStateStamps,
  pushEffect,
  sampleMotion,
  smokeCloudBumps,
  smokeDissipate,
  smokePhaseOffset,
  sortPlayersForDraw,
  stateElapsed,
  syncGrenadeSnapshots,
  type SmokeBump,
} from './canvas/scene'

const props = defineProps<{
  mapConfig: MapConfig | null
  size: number
  zoom: number
  zoomOrigin: [number, number]
  players: RadarPlayerObject[]
  grenades: RadarGrenadeObject[]
  bombObjects: RadarBombObject[]
  fires: RadarFireObject[]
}>()

const { teamColor, settings: haiSettings } = useHaiSettings()

const DEG = Math.PI / 180

/**
 * 投掷物贴图的绘制框，单位是 1024 雷达坐标系里的像素。
 *
 * 它**不是**「1 个贴图」的意思：画布会把 1024 坐标系缩放成实际显示尺寸，
 * 1 个单位只有约 0.4 屏幕像素，贴图会小到肉眼看不出（掉落的 C4 就是这样消失的）。
 */
const GRENADE_BOX_SIZE = 36
const SMOKE_RIM_COLOR = 'rgba(255, 255, 255, 0.9)'
const SMOKE_RIM_WIDTH = 7
const BOMB_BOX_SIZE = 36
const BOMB_SPRITE_RATIO = 1.2
/** 炸弹贴图自带留白（116×147），在框内等比缩放后再放大一点，视觉上与投掷物相当。 */
const BOMB_DRAW_BOX = BOMB_BOX_SIZE * BOMB_SPRITE_RATIO
/** 玩家编号的字号（缩放前，单位是 1024 坐标系）。 */
const LABEL_FONT_SIZE = 35
const LABEL_SHADOW_OFFSET_X = 1
const LABEL_SHADOW_OFFSET_Y = 2
const LABEL_SHADOW_BLUR = 3
/**
 * 「保持原屏幕尺寸」的系数。
 *
 * 画布整体按 zoom 缩放，视觉权重（线宽、字号、图标框）要乘上它，
 * 放大后才不会跟着一起变粗变大；zoom = 1 时恒为 1，等价于没有这层处理。
 */
const viewDescale = (zoom: number): number => 1 / Math.max(1, zoom)
const MARKER_NOSE_FILL = '#fff'
const MARKER_OUTLINE_COLOR = 'rgba(0, 0, 0, 0.9)'
const MARKER_OUTLINE_WIDTH = 3
const BADGE_SHADOW = 'rgba(0, 0, 0, 0.6)'
/** 同时携带两件时，第二个徽标往左挪的比例（相对徽标尺寸）。 */
const BADGE_STEP_RATIO = 0.85
const FOCUS_RING_OFFSET = 0
const FOCUS_RING_WIDTH = 5
const FOCUS_RING_COLOR = 'rgba(255, 255, 255, 0.85)'
const TRACER_WIDTH = 6
const TRACER_DASH = 12
const TRACER_SHADOW = 'rgba(0, 0, 0, 0.85)'
const TEXT_SHADOW = 'rgba(0, 0, 0, 1)'
const FIRE_FILL = 'rgba(255, 46, 22, 0.5)'
const FIRE_STROKE = '#ff9a3c'
/** 爆炸/拆除圆环的线宽（1024 坐标系里的像素）。 */
const RING_WIDTH = 6
/**
 * 圆环起始透明度。
 *
 * 别复用 DEAD_ALPHA：那个常量是玩家显隐用的（一度被改成 0 来隐藏死亡玩家），
 * 特效透明度乘上它就会变成完全透明 —— 看起来像"没有爆炸效果"。
 */
const RING_ALPHA = 0.85
const BOMB_RING_MS = 2000
const BOMB_PLANTED_SPREAD = 50
const DEAD_ALPHA = 0

const canvasEl = ref<HTMLCanvasElement | null>(null)

/**
 * 玩家标记 / 烟雾 / 火焰描边都可以在设置面板里调；字段缺失时回落到 config 的默认值，
 * 因此旧数据包与第三方 Overlay 的行为不变。
 */
const radarVisual = computed(() => ({
  playerSize: haiSettings.value?.overlayRadarPlayerSize ?? config.playerSize,
  smokeSize: haiSettings.value?.overlayRadarSmokeSize ?? config.smokeSize,
  fireStroke: haiSettings.value?.overlayRadarFireStroke ?? config.fireStrokeWidth,
}))

/** 最后一个已知的炸弹坐标：bombExplode / bombDefuse 事件没有位置载荷，用它摆特效。 */
let lastBombPosition: [number, number] | null = null

const isExplodedBlast = (grenade: RadarGrenadeObject): boolean =>
  (grenade.type === 'frag' || grenade.type === 'flashbang') && grenade.state === 'exploded'

/** 已落地的烟雾：画成会蠕动的云朵，而不是圆形。 */
const isSettledSmoke = (grenade: RadarGrenadeObject): boolean =>
  grenade.type === 'smoke' && (grenade.state === 'landed' || grenade.state === 'exploded')

const bombKey = (bomb: RadarBombObject): string => `bomb:${bomb.id}`

/**
 * 画布 backing store 按「实际显示尺寸 × DPR」建立。
 *
 * 用 getBoundingClientRect 取实际占位，是为了把祖先上的缩放（例如整页自适应缩放）也算进去，
 * 否则画布会被拉伸重采样，看起来发糊。只有尺寸变了才重建。
 */
const syncCanvasSize = (): void => {
  const canvas = canvasEl.value

  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const displaySize = rect.width > 0 ? rect.width : props.size
  const size = Math.max(1, Math.round(displaySize * dpr))

  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size
    canvas.height = size
  }
}

const traceRing = (ctx: CanvasRenderingContext2D, ring: [number, number][]): void => {
  const head = ring[0]

  if (!head) return

  ctx.moveTo(head[0], head[1])

  for (let index = 1; index < ring.length; index += 1) {
    const point = ring[index]!

    ctx.lineTo(point[0], point[1])
  }

  ctx.closePath()
}

/** 扩散圆环：半径随进度变大、透明度随之衰减。 */
const drawRingPulse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  color: string,
  descale: number,
): void => {
  ctx.save()
  ctx.globalAlpha = clamp01(alpha)
  ctx.strokeStyle = color
  ctx.lineWidth = RING_WIDTH * descale
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0.5, radius), 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** 一次性爆炸 / 拆除特效。 */
const drawEffects = (ctx: CanvasRenderingContext2D, now: number, descale: number): void => {
  for (const frame of getEffectFrames(now)) {
    drawRingPulse(
      ctx,
      frame.effect.x,
      frame.effect.y,
      frame.radius,
      frame.alpha,
      frame.effect.color,
      descale,
    )
  }
}

const drawMap = (ctx: CanvasRenderingContext2D): void => {
  const image = getImage(props.mapConfig?.file)

  if (!image) return

  ctx.drawImage(image, 0, 0, RADAR_SIZE, RADAR_SIZE)
}

const drawTrails = (ctx: CanvasRenderingContext2D, now: number, descale: number): void => {
  const trails = getTrailRenderablesNumeric(now)

  if (trails.length === 0) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = TRAIL_STROKE_WIDTH * descale
  ctx.setLineDash(TRAIL_DASH_PATTERN.map((segment) => segment * descale))

  for (const trail of trails) {
    if (!trail.visible || trail.alpha <= 0) continue

    const head = trail.points[0]

    if (!head) continue

    ctx.globalAlpha = trail.alpha
    // 相位跟着「已裁掉的长度」走：轨迹超长被裁剪时，虚线图案才不会整条滑动
    ctx.lineDashOffset = trail.dashOffset * descale
    ctx.strokeStyle = colorFromVars(
      teamColor(trail.side ?? 'CT'),
      '--main-80',
      'rgba(255, 255, 255, 0.8)',
    )
    ctx.beginPath()
    ctx.moveTo(head[0], head[1])

    for (let index = 1; index < trail.points.length; index += 1) {
      const point = trail.points[index]!

      ctx.lineTo(point[0], point[1])
    }

    ctx.stroke()
  }

  ctx.restore()
}

const drawFires = (ctx: CanvasRenderingContext2D, now: number, descale: number): void => {
  for (const fire of getFireRings(now)) {
    if (!fire.visible || fire.rings.length === 0) continue

    ctx.save()
    ctx.beginPath()

    for (const ring of fire.rings) traceRing(ctx, ring)

    ctx.fillStyle = FIRE_FILL
    ctx.fill('evenodd')
    ctx.lineWidth = radarVisual.value.fireStroke * descale
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = FIRE_STROKE
    ctx.stroke()
    ctx.restore()
  }
}

/**
 * 把若干个圆画进同一条路径。
 *
 * 同一条路径用非零环绕规则整体填充一次，得到的就是并集：
 * 既没有圆与圆之间的接缝，半透明时也不会因为逐圆叠加而露出内部边缘。
 */
const traceCircles = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bumps: SmokeBump[],
  grow: number,
): void => {
  for (const bump of bumps) {
    const radius = bump.radius + grow

    ctx.moveTo(x + bump.x + radius, y + bump.y)
    ctx.arc(x + bump.x, y + bump.y, radius, 0, Math.PI * 2)
  }
}

/**
 * 落地烟雾：用几个圆的并集画成一朵云朵简笔画。
 *
 * 先把每个圆放大一圈铺上描边色，再用队色铺原尺寸，
 * 剩下的正好是云朵外轮廓——圆与圆之间的接缝会被第二遍盖掉。
 */
const drawSmokeCloud = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
  now: number,
  phaseOffset: number,
  descale: number,
): void => {
  const bumps = smokeCloudBumps(radius, now, phaseOffset)

  ctx.save()

  // 描边色：放大一圈的并集，只填一次
  ctx.beginPath()
  traceCircles(ctx, x, y, bumps, SMOKE_RIM_WIDTH * descale)
  ctx.fillStyle = SMOKE_RIM_COLOR
  ctx.fill()

  // 队色：原尺寸的并集，再填一次
  ctx.beginPath()
  traceCircles(ctx, x, y, bumps, 0)
  ctx.fillStyle = fill
  ctx.fill()

  ctx.restore()
}

const drawGrenades = (ctx: CanvasRenderingContext2D, now: number, descale: number): void => {
  for (const grenade of props.grenades) {
    const settledSmoke = isSettledSmoke(grenade)
    const motion = sampleMotion(
      grenade.id,
      {
        x: grenade.position[0] ?? 0,
        y: grenade.position[1] ?? 0,
        yaw: 0,
        scale: 1,
        alpha: grenade.visible ? 1 : 0,
      },
      now,
    )

    if (motion.alpha <= 0.01) continue

    // 落地烟雾是地图上的实际覆盖范围（随缩放变大）；飞行中的图标属于视觉权重（保持原尺寸）
    const box = settledSmoke ? radarVisual.value.smokeSize : GRENADE_BOX_SIZE * descale

    ctx.save()
    ctx.globalAlpha = motion.alpha

    if (settledSmoke) {
      // 进入最后一个相位后一边变淡一边胀开，做出「散去」的过渡
      const dissipate =
        grenade.state === 'exploded'
          ? smokeDissipate(stateElapsed(grenade.id, grenade.state, now))
          : { alpha: 1, scale: 1 }

      ctx.globalAlpha = motion.alpha * dissipate.alpha

      drawSmokeCloud(
        ctx,
        motion.x,
        motion.y,
        (box / 2) * dissipate.scale,
        colorFromVars(teamColor(grenade.side ?? 'CT'), '--main-100', 'rgba(255, 255, 255, 1)'),
        now,
        smokePhaseOffset(grenade.id),
        descale,
      )
    } else if (!isExplodedBlast(grenade)) {
      const sprite = grenadeSprite(grenade.type, grenade.state)
      const image = getImage(sprite?.src)

      if (sprite && image) {
        const size = containSize(image.naturalWidth, image.naturalHeight, box, box)

        if (sprite.invert) ctx.filter = 'invert(1)'

        ctx.drawImage(
          image,
          motion.x - size.width / 2,
          motion.y - size.height / 2,
          size.width,
          size.height,
        )
        ctx.filter = 'none'
      }
    }

    ctx.restore()

    // 手雷炸开：观察到 exploded 就地起一圈特效（实体直接消失的情况由消失兜底补上）
    if (isExplodedBlast(grenade)) {
      pushEffect(`blast:${grenade.id}`, 'blast', [motion.x, motion.y], now)
    }
  }
}

const drawBombs = (ctx: CanvasRenderingContext2D, now: number, descale: number): void => {
  for (const bomb of props.bombObjects) {
    const key = bombKey(bomb)
    const motion = sampleMotion(
      key,
      {
        x: bomb.position[0],
        y: bomb.position[1],
        yaw: 0,
        scale: 1,
        alpha: bomb.visible ? 1 : 0,
      },
      now,
    )

    // 记下最后一个已知坐标：爆炸 / 拆除事件触发时用它摆特效
    lastBombPosition = [motion.x, motion.y]

    if (motion.alpha <= 0.01) continue

    const image = getImage(BOMB_SPRITE)

    if (image) {
      const size = containSize(
        image.naturalWidth,
        image.naturalHeight,
        BOMB_DRAW_BOX * descale,
        BOMB_DRAW_BOX * descale,
      )

      ctx.save()
      ctx.globalAlpha = motion.alpha
      ctx.filter = 'grayscale(1)'
      ctx.drawImage(
        image,
        motion.x - size.width / 2,
        motion.y - size.height / 2,
        size.width,
        size.height,
      )
      ctx.restore()
    }

    const planted = bomb.state === 'planted' || bomb.state === 'defusing'
    const elapsed = stateElapsed(key, bomb.state, now)

    if (planted) {
      const progress = expandProgress(elapsed, BOMB_RING_MS, true)

      if (progress !== null) {
        drawRingPulse(
          ctx,
          motion.x,
          motion.y,
          BOMB_PLANTED_SPREAD * progress,
          RING_ALPHA * (1 - progress),
          RADAR_EFFECT_STYLES.explode.color,
          descale,
        )
      }

      continue
    }

    // 状态兜底：事件万一没送到，也能播出爆炸 / 拆除圆环（同 id 会去重）
    if (bomb.state === 'exploded') {
      pushEffect('bomb:explode', 'explode', [motion.x, motion.y], now)
    }

    if (bomb.state === 'defused') {
      pushEffect('bomb:defuse', 'defuse', [motion.x, motion.y], now)
    }
  }
}

const drawTracer = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  yaw: number,
  length: number,
  descale: number,
): void => {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(headingRotation(yaw) * DEG)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = TRACER_WIDTH * descale
  ctx.lineCap = 'round'
  ctx.setLineDash([TRACER_DASH * descale, TRACER_DASH * descale])
  ctx.shadowColor = TRACER_SHADOW
  ctx.shadowBlur = 2 * descale
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(length, 0)
  ctx.stroke()
  ctx.restore()
}

/**
 * 玩家标记：圆与前方尖角合成的一条连续轮廓。
 *
 * 先铺队色主体，再把尖角区域填白，最后沿整条外轮廓描一圈细边——
 * 描边压在两种颜色之上，视觉上就把它们锁成了一个整体。
 */
const drawPlayerMarker = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  yaw: number,
  radius: number,
  bodyColor: string,
  descale: number,
): void => {
  const { tip, tangentA, tangentB, tangentAngle } = playerMarkerGeometry(radius)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(headingRotation(yaw) * DEG)

  // 圆 + 尖角：外轮廓
  ctx.beginPath()
  ctx.moveTo(tangentB[0], tangentB[1])
  ctx.lineTo(tip[0], tip[1])
  ctx.lineTo(tangentA[0], tangentA[1])
  ctx.arc(0, 0, radius, tangentAngle, Math.PI * 2 - tangentAngle)
  ctx.closePath()
  ctx.fillStyle = bodyColor
  ctx.fill()

  // 尖角区域
  ctx.beginPath()
  ctx.moveTo(tangentA[0], tangentA[1])
  ctx.lineTo(tip[0], tip[1])
  ctx.lineTo(tangentB[0], tangentB[1])
  ctx.arc(0, 0, radius, -tangentAngle, tangentAngle)
  ctx.closePath()
  ctx.fillStyle = MARKER_NOSE_FILL
  ctx.fill()

  // 整条外轮廓描边，把主体与尖角锁在一起
  ctx.beginPath()
  ctx.moveTo(tangentB[0], tangentB[1])
  ctx.lineTo(tip[0], tip[1])
  ctx.lineTo(tangentA[0], tangentA[1])
  ctx.arc(0, 0, radius, tangentAngle, Math.PI * 2 - tangentAngle)
  ctx.closePath()
  ctx.lineWidth = MARKER_OUTLINE_WIDTH * descale
  ctx.lineJoin = 'round'
  ctx.strokeStyle = MARKER_OUTLINE_COLOR
  ctx.stroke()

  ctx.restore()
}

/** 携带物徽标：压在标记右上角，白色图标配一点暗投影，保证在浅色地图上也看得清。 */
const drawPlayerBadge = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  src: string,
  index: number,
  descale: number,
): void => {
  const image = getImage(src)

  if (!image) return

  const badge = playerBadgeRect(radius)
  const size = containSize(image.naturalWidth, image.naturalHeight, badge.size, badge.size)
  const offsetX = badge.x - index * badge.size * BADGE_STEP_RATIO

  ctx.save()
  ctx.shadowColor = BADGE_SHADOW
  ctx.shadowBlur = 3 * descale
  ctx.drawImage(
    image,
    x + offsetX - size.width / 2,
    y + badge.y - size.height / 2,
    size.width,
    size.height,
  )
  ctx.restore()
}

const drawPlayers = (ctx: CanvasRenderingContext2D, now: number, descale: number): void => {
  for (const player of sortPlayersForDraw(props.players)) {
    // 标记尺寸属于视觉权重：乘 descale 后，放大时仍保持原来的屏幕大小
    const box = radarVisual.value.playerSize * player.scale * descale
    const radius = box / 2
    const motion = sampleMotion(
      player.id,
      {
        x: player.position[0] ?? 0,
        y: player.position[1] ?? 0,
        yaw: player.position[2] ?? 0,
        scale: 1,
        alpha: (player.visible ? 1 : 0) * (player.isAlive ? 1 : DEAD_ALPHA),
      },
      now,
    )

    if (motion.alpha <= 0.01) continue

    if (player.isAlive && isShootingNow(player.lastShoot, now)) {
      ctx.save()
      ctx.globalAlpha = motion.alpha
      drawTracer(ctx, motion.x, motion.y, motion.yaw, box, descale)
      ctx.restore()
    }

    ctx.save()
    ctx.globalAlpha = motion.alpha

    if (player.isAlive) {
      const bodyColor = colorFromVars(
        teamColor(player.side),
        '--main-90',
        'rgba(255, 255, 255, 0.9)',
      )

      drawPlayerMarker(ctx, motion.x, motion.y, motion.yaw, radius, bodyColor, descale)

      // 当前观战对象：圆外一圈描边
      if (player.isActive) {
        ctx.beginPath()
        ctx.arc(motion.x, motion.y, radius + FOCUS_RING_OFFSET * descale, 0, Math.PI * 2)
        ctx.lineWidth = FOCUS_RING_WIDTH * descale
        ctx.strokeStyle = FOCUS_RING_COLOR
        ctx.stroke()
      }

      // 携带物徽标：C4 / 拆弹器，压在标记右上角
      const badges = [
        player.hasBomb ? C4_SPRITE : null,
        player.state?.defusekit ? DEFUSER_SPRITE : null,
      ].filter((src): src is string => src !== null)

      badges.forEach((src, index) => {
        drawPlayerBadge(ctx, motion.x, motion.y, radius, src, index, descale)
      })
    }

    ctx.font = `800 ${LABEL_FONT_SIZE * descale}px "Sora Variable", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.shadowColor = TEXT_SHADOW
    ctx.shadowOffsetX = LABEL_SHADOW_OFFSET_X * descale
    ctx.shadowOffsetY = LABEL_SHADOW_OFFSET_Y * descale
    ctx.shadowBlur = LABEL_SHADOW_BLUR * descale
    ctx.fillText(String(player.observer_slot ?? ''), motion.x, motion.y)
    ctx.restore()
  }
}

const draw = (now: number): void => {
  const canvas = canvasEl.value
  const ctx = canvas?.getContext('2d')

  if (!canvas || !ctx) return

  const scale = canvas.width / RADAR_SIZE

  // 1024 的地图要缩到几百像素，默认的 low 重采样会糊；high 会做一次像样的降采样
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  if (props.zoom !== 1) {
    ctx.translate(props.zoomOrigin[0], props.zoomOrigin[1])
    ctx.scale(props.zoom, props.zoom)
    ctx.translate(-props.zoomOrigin[0], -props.zoomOrigin[1])
  }

  // 几何随 zoom 放大；线宽 / 字号 / 图标框乘 descale，保持原来的屏幕尺寸
  const descale = viewDescale(props.zoom)

  drawMap(ctx)
  drawTrails(ctx, now, descale)
  drawFires(ctx, now, descale)
  drawGrenades(ctx, now, descale)
  drawBombs(ctx, now, descale)
  drawEffects(ctx, now, descale)
  drawPlayers(ctx, now, descale)
}

/** 还有未完成的动画时继续跑帧，空闲就停。 */
const needsFrame = (now: number): boolean => {
  if (hasPendingMotion(now)) return true

  // 爆炸 / 拆除圆环还在播
  if (hasActiveEffects(now)) return true

  // 落地烟雾一直在蠕动，只要场上有烟就得继续跑帧
  if (props.grenades.some(isSettledSmoke)) return true

  if (props.players.some((player) => player.isAlive && isShootingNow(player.lastShoot, now))) {
    return true
  }
  if (getTrailRenderablesNumeric(now).some((trail) => trail.alpha > 0 && trail.alpha < 1))
    return true

  // 已安放的 C4 一直在循环脉冲
  return props.bombObjects.some((bomb) => bomb.state === 'planted' || bomb.state === 'defusing')
}

let rafId: number | null = null

const pruneStores = (): void => {
  const activeIds = new Set<string>()

  for (const player of props.players) activeIds.add(player.id)
  for (const grenade of props.grenades) activeIds.add(grenade.id)
  for (const bomb of props.bombObjects) activeIds.add(bombKey(bomb))

  pruneMotions(activeIds)
  pruneStateStamps(activeIds)
}

/**
 * 手雷爆炸的兜底触发。
 *
 * 上游只对 C4 派发 bombExplode / bombDefuse，手雷没有事件，
 * 因此 frag / flashbang 若直接从数据里消失，就用最后已知坐标补一次爆炸圆环。
 */
const syncBlastFallback = (now: number): void => {
  for (const grenade of syncGrenadeSnapshots(props.grenades)) {
    if (grenade.type !== 'frag' && grenade.type !== 'flashbang') continue

    pushEffect(`blast:${grenade.id}`, 'blast', [grenade.x, grenade.y], now)
  }
}

const tick = (): void => {
  rafId = null

  const now = Date.now()

  syncFireTargets(props.fires, now)
  pruneStores()
  syncBlastFallback(now)

  const morphing = advanceFireMorphs(now)

  draw(now)

  if (morphing || needsFrame(now)) {
    rafId = requestAnimationFrame(tick)
  }
}

const requestDraw = (): void => {
  if (rafId !== null) return

  rafId = requestAnimationFrame(tick)
}

const handleResize = (): void => {
  syncCanvasSize()
  requestDraw()
}

let stopAssets: (() => void) | null = null

watch(
  [
    () => props.mapConfig,
    () => props.size,
    () => props.players,
    () => props.grenades,
    () => props.bombObjects,
    () => props.fires,
    () => props.zoom,
    () => props.zoomOrigin,
  ],
  () => {
    syncCanvasSize()
    requestDraw()
  },
  { immediate: true },
)

/**
 * C4 爆炸 / 拆除：服务端会转发这两个事件，比"等某个状态出现在数据里"可靠得多。
 * 事件没有位置载荷，所以用最后一个已知的炸弹坐标。
 */
useGsiEvent('bombExplode', () => {
  if (lastBombPosition) pushEffect('bomb:explode', 'explode', lastBombPosition, Date.now())

  requestDraw()
})

useGsiEvent('bombDefuse', () => {
  if (lastBombPosition) pushEffect('bomb:defuse', 'defuse', lastBombPosition, Date.now())

  requestDraw()
})

onMounted(() => {
  syncCanvasSize()
  preloadSprites()
  stopAssets = onAssetsUpdated(requestDraw)
  window.addEventListener('resize', handleResize)
  requestDraw()
})

onUnmounted(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  stopAssets?.()
  stopAssets = null
  window.removeEventListener('resize', handleResize)
  pruneMotions(new Set())
  pruneStateStamps(new Set())
})
</script>

<template>
  <canvas ref="canvasEl" class="radar-canvas" aria-hidden="true" />
</template>

<style scoped>
/*
 * 画布直接铺满显示尺寸的容器：内部仍按 1024 坐标系绘制，
 * backing store 由脚本按「实际显示尺寸 × DPR」设置，保证像素一比一。
 */
.radar-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
