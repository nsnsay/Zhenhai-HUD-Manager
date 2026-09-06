// types.ts
import type { InjectionKey, ComputedRef } from 'vue'
import type { SettingFormData } from '@zhenhai/csgogsi/types'

export type TeamSide = 'CT' | 'T'

export interface HaiSettingsContext {
  settings: ComputedRef<SettingFormData | undefined>
  teamColor: (side: TeamSide) => Record<string, string>
  teamAttrs: (side: TeamSide) => { class: string; style: Record<string, string> } // 改为 string
  globalVars: ComputedRef<Record<string, string>>
}

export const HAI_SETTINGS_KEY: InjectionKey<HaiSettingsContext> = Symbol('hai-settings')
