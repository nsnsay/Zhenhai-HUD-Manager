<script setup lang="ts">
import { computed, onUnmounted, provide, watch } from 'vue'
import type { SettingFormData } from '@zhenhai/csgogsi/types'
import { HAI_SETTINGS_KEY, type TeamSide } from './types'

const props = defineProps<{
  settings?: SettingFormData
}>()

type Rgb = {
  r: number
  g: number
  b: number
}

type ColorKey = 'ct' | 't' | 'primary' | 'secondary'

type TeamRule = {
  selector: string
  vars: Record<string, string>
}

const ALPHA_START = 0
const ALPHA_STEP = 5

const COLOR_FIELD_CANDIDATES: Record<ColorKey, string[]> = {
  ct: ['ctDefaultColor', 'ctColor', 'CTColor', 'ct'],
  t: ['tDefaultColor', 'tColor', 'TColor', 't'],
  primary: ['primaryDefaultColor', 'primaryColor', 'PrimaryColor', 'primary'],
  secondary: ['secondaryDefaultColor', 'secondaryColor', 'SecondaryColor', 'secondary'],
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = normalizeHue(h) / 360
  const sat = clamp(s, 0, 100) / 100
  const light = clamp(l, 0, 100) / 100

  if (sat === 0) {
    const v = Math.round(light * 255)
    return { r: v, g: v, b: v }
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q

  const hue2rgb = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  return {
    r: Math.round(hue2rgb(hue + 1 / 3) * 255),
    g: Math.round(hue2rgb(hue) * 255),
    b: Math.round(hue2rgb(hue - 1 / 3) * 255),
  }
}

function parseRgbChannel(channel: string): number {
  if (channel.endsWith('%')) {
    return clamp(Math.round((parseFloat(channel) / 100) * 255), 0, 255)
  }

  return clamp(Math.round(parseFloat(channel)), 0, 255)
}

function parseColor(color?: string): Rgb | null {
  if (!color) return null

  const value = color.trim()
  if (!value) return null

  if (value.startsWith('#')) {
    let hex = value.slice(1)

    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    }

    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)

      if ([r, g, b].some(Number.isNaN)) return null

      return {
        r: clamp(r, 0, 255),
        g: clamp(g, 0, 255),
        b: clamp(b, 0, 255),
      }
    }

    return null
  }

  const rgbMatch = value.match(
    /^rgba?\(\s*(\d{1,3}(?:\.\d+)?%?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?%?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?%?)/i,
  )

  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    return {
      r: parseRgbChannel(rgbMatch[1]),
      g: parseRgbChannel(rgbMatch[2]),
      b: parseRgbChannel(rgbMatch[3]),
    }
  }

  const hslMatch = value.match(
    /^hsla?\(\s*(\d+(?:\.\d+)?)(?:deg)?\s*[,\s]\s*(\d+(?:\.\d+)?)%\s*[,\s]\s*(\d+(?:\.\d+)?)%/i,
  )

  if (hslMatch && hslMatch[1] && hslMatch[2] && hslMatch[3]) {
    return hslToRgb(parseFloat(hslMatch[1]), parseFloat(hslMatch[2]), parseFloat(hslMatch[3]))
  }

  return null
}

function generateColorVars(color: string, prefix: string): Record<string, string> {
  const rgb = parseColor(color)
  if (!rgb) return {}

  const vars: Record<string, string> = {
    '--hai-safe-x': `${props.settings?.overlaySafeZoneX ?? 0}px`,
    '--hai-safe-y': `${props.settings?.overlaySafeZoneY ?? 0}px`,
  }

  for (let alpha = ALPHA_START; alpha <= 100; alpha += ALPHA_STEP) {
    vars[`--${prefix}-${alpha}`] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha / 100})`
  }

  return vars
}

function getColor(settings: SettingFormData, key: ColorKey): string | undefined {
  const record = settings as unknown as Record<string, unknown>

  for (const field of COLOR_FIELD_CANDIDATES[key]) {
    const value = record[field]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

function getColors(settings?: SettingFormData) {
  if (!settings) {
    return {
      ct: undefined,
      t: undefined,
      primary: undefined,
      secondary: undefined,
    }
  }

  return {
    ct: getColor(settings, 'ct'),
    t: getColor(settings, 't'),
    primary: getColor(settings, 'primary'),
    secondary: getColor(settings, 'secondary'),
  }
}

function createMainVars(color: string): Record<string, string> {
  return {
    '--main-base': color,
    ...generateColorVars(color, 'main'),
  }
}

function applyVarsToRoot(vars: Record<string, string>): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

function removeVarsFromRoot(vars: Record<string, string>): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  for (const key of Object.keys(vars)) {
    root.style.removeProperty(key)
  }
}

let teamStyleEl: HTMLStyleElement | null = null

function ensureTeamStyleEl(): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null

  if (!teamStyleEl || !teamStyleEl.isConnected) {
    teamStyleEl = document.createElement('style')
    teamStyleEl.setAttribute('data-hai-team-classes', '')
    document.head.appendChild(teamStyleEl)
  }

  return teamStyleEl
}

function clearTeamRules(sheet: CSSStyleSheet): void {
  while (sheet.cssRules.length > 0) {
    sheet.deleteRule(0)
  }
}

function escapeCssValue(value: string): string {
  return value.replace(/[;{}<>]/g, '')
}

function renderTeamCssText(rules: TeamRule[]): string {
  return rules
    .map(({ selector, vars }) => {
      const declarations = Object.entries(vars)
        .map(([key, value]) => `${key}: ${escapeCssValue(value)};`)
        .join(' ')

      return `${selector} { ${declarations} }`
    })
    .join('\n')
}

function applyTeamRules(rules: TeamRule[]): void {
  if (typeof document === 'undefined') return

  if (!rules.length) {
    if (teamStyleEl) {
      teamStyleEl.remove()
      teamStyleEl = null
    }

    return
  }

  const el = ensureTeamStyleEl()
  if (!el) return

  const sheet = el.sheet

  if (!sheet) {
    el.textContent = renderTeamCssText(rules)
    return
  }

  try {
    clearTeamRules(sheet)

    for (const { selector, vars } of rules) {
      const index = sheet.insertRule(`${selector} {}`, sheet.cssRules.length)
      const rule = sheet.cssRules[index] as CSSStyleRule

      for (const [key, value] of Object.entries(vars)) {
        try {
          rule.style.setProperty(key, value)
        } catch {
          // 单个变量设置失败时跳过，避免影响其余变量
        }
      }
    }
  } catch {
    el.textContent = renderTeamCssText(rules)
  }
}

const colors = computed(() => getColors(props.settings))

const globalVars = computed<Record<string, string>>(() => {
  const s = props.settings
  if (!s) return {}

  const c = colors.value
  const vars: Record<string, string> = {}

  if (c.ct) {
    vars['--ct-base'] = c.ct
    Object.assign(vars, generateColorVars(c.ct, 'ct'))
  }

  if (c.t) {
    vars['--t-base'] = c.t
    Object.assign(vars, generateColorVars(c.t, 't'))
  }

  if (c.primary) {
    vars['--pr-base'] = c.primary
    vars['--primary-color'] = c.primary
    Object.assign(vars, generateColorVars(c.primary, 'pr'))
  }

  if (c.secondary) {
    vars['--se-base'] = c.secondary
    vars['--secondary-color'] = c.secondary
    Object.assign(vars, generateColorVars(c.secondary, 'se'))
  }

  vars['--hai-radius'] = `${s.overlayBorderRadius ?? 0}px`

  return vars
})

const teamRules = computed<TeamRule[]>(() => {
  const c = colors.value
  const rules: TeamRule[] = []

  if (c.ct) {
    rules.push({
      selector: '.CT',
      vars: createMainVars(c.ct),
    })
  }

  if (c.t) {
    rules.push({
      selector: '.T',
      vars: createMainVars(c.t),
    })
  }

  return rules
})

function teamColor(side: TeamSide): Record<string, string> {
  const c = colors.value
  const color = side === 'CT' ? c.ct : c.t

  if (!color) return {}

  return createMainVars(color)
}

function teamAttrs(side: TeamSide): { class: string; style: Record<string, string> } {
  return {
    class: `group ${side}`,
    style: {},
  }
}

watch(
  globalVars,
  (newVars, oldVars) => {
    if (oldVars) removeVarsFromRoot(oldVars)
    applyVarsToRoot(newVars)
  },
  { immediate: true },
)

watch(teamRules, applyTeamRules, { immediate: true })

onUnmounted(() => {
  removeVarsFromRoot(globalVars.value)

  if (teamStyleEl) {
    teamStyleEl.remove()
    teamStyleEl = null
  }
})

provide(HAI_SETTINGS_KEY, {
  settings: computed(() => props.settings),
  teamColor,
  teamAttrs,
  globalVars,
})
</script>

<template>
  <slot />
</template>
