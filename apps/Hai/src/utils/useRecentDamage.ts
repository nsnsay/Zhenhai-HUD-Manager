import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Player } from '@zhenhai/csgogsi'

const MAX_HEALTH = 100
const DAMAGE_WINDOW_MS = 2500

export function useRecentDamage(playerGetter: () => Player | undefined) {
  const damageAmount = ref(0)
  const damageVisible = ref(false)
  const health = computed(() => {
    const value = Number(playerGetter()?.state?.health ?? MAX_HEALTH)
    return Math.min(MAX_HEALTH, Math.max(0, Math.round(value)))
  })
  const steamId = computed(() => playerGetter()?.steamid ?? '')

  let damageWindowEnd = 0
  let damageTimer: number | undefined

  function clearDamage(): void {
    damageAmount.value = 0
    damageVisible.value = false
    damageWindowEnd = 0

    if (damageTimer !== undefined) {
      window.clearTimeout(damageTimer)
      damageTimer = undefined
    }
  }

  function recordDamage(amount: number): void {
    if (amount <= 0) return

    const now = performance.now()
    damageAmount.value =
      now < damageWindowEnd
        ? Math.min(MAX_HEALTH, damageAmount.value + Math.round(amount))
        : Math.round(amount)
    damageWindowEnd = now + DAMAGE_WINDOW_MS
    damageVisible.value = true

    if (damageTimer !== undefined) {
      window.clearTimeout(damageTimer)
    }

    damageTimer = window.setTimeout(() => {
      damageAmount.value = 0
      damageVisible.value = false
      damageTimer = undefined
    }, DAMAGE_WINDOW_MS)
  }

  watch(
    [steamId, health],
    ([newSteamId, newHealth], [oldSteamId, oldHealth]) => {
      if (newSteamId !== oldSteamId) {
        clearDamage()
        return
      }

      if (oldHealth === undefined) return

      if (newHealth >= oldHealth) {
        clearDamage()
        return
      }

      recordDamage(oldHealth - newHealth)
    },
    { flush: 'sync' },
  )

  onBeforeUnmount(clearDamage)

  return {
    damageAmount,
    damageVisible,
    health,
  }
}
