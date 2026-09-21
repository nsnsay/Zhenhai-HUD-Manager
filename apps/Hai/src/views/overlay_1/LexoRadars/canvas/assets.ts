/**
 * 雷达画布用到的图片资源：统一在这里 import、缓存，并在加载完成后通知重绘。
 *
 * 画布不像 CSS 那样会自动等图片，所以取图时同步返回（未就绪给 null），
 * 加载完成后再触发一次绘制。
 */
import { haiLogger } from '@/utils/haiLogger'

import bombIcon from '../utils/grenades/bomb.png'
import firebombIcon from '../utils/grenades/firebomb.png'
import flashIcon from '../utils/grenades/flash.png'
import fragIcon from '../utils/grenades/frag.png'
import smokeIcon from '../utils/grenades/smoke.png'

export const BOMB_SPRITE = bombIcon

/** 玩家标记上的携带物徽标，沿用 HUD 已经在用的白色 C4 / 拆弹器图标。 */
export const DEFUSER_SPRITE = `${import.meta.env.BASE_URL}equipment/defuser.svg`
export const C4_SPRITE = `${import.meta.env.BASE_URL}equipment/c4.svg`

/**
 * 投掷物图标。
 *
 * invert 对应原来的 CSS `filter: invert(1)`：烟雾只在空中用反色图标，
 * 落地后画成白色半透明圆；decoy 在原实现里没有图标，这里同样返回 null。
 */
export const grenadeSprite = (
  type: string,
  state: string,
): { src: string; invert: boolean } | null => {
  switch (type) {
    case 'smoke':
      return state === 'inair' ? { src: smokeIcon, invert: true } : null
    case 'flashbang':
      return { src: flashIcon, invert: true }
    case 'frag':
      return { src: fragIcon, invert: true }
    case 'firebomb':
      return { src: firebombIcon, invert: true }
    default:
      return null
  }
}

const images = new Map<string, HTMLImageElement>()
const failed = new Set<string>()
const listeners = new Set<() => void>()

const notify = (): void => {
  for (const listener of listeners) listener()
}

/** 订阅「有图片加载完成或失败」，返回取消订阅函数。 */
export const onAssetsUpdated = (listener: () => void): (() => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

/** 取已就绪的图片；未就绪时开始加载并返回 null，加载完成后会通知重绘。 */
export const getImage = (src: string | undefined): HTMLImageElement | null => {
  if (!src || failed.has(src)) return null

  const cached = images.get(src)

  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null

  const image = new Image()

  image.decoding = 'async'
  image.onload = () => notify()
  image.onerror = () => {
    failed.add(src)
    images.delete(src)
    haiLogger.warn('RadarCanvas', '图片加载失败，已跳过该元素', { src })
    notify()
  }
  image.src = src
  images.set(src, image)

  return null
}

/** 组件挂载时预热固定贴图，避免首帧缺图。 */
export const preloadSprites = (): void => {
  for (const src of [
    BOMB_SPRITE,
    DEFUSER_SPRITE,
    C4_SPRITE,
    smokeIcon,
    flashIcon,
    fragIcon,
    firebombIcon,
  ]) {
    getImage(src)
  }
}
