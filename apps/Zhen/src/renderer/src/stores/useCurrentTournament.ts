import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useTournamentsStore, type TournamentRecord } from './useTournamentsStore'
import { getAssetUrl } from '@renderer/utils/assets-url'
import { rendererLogger } from '@renderer/utils/logger'

interface TournamentOption {
  label: string
  value: string
  avatar?: { src: string; alt?: string }
}

export const useCurrentTournament = defineStore('current-tournament', () => {
  const tournamentsStore = useTournamentsStore()

  const currentId = ref<string>(localStorage.getItem('zh-current-tournament') ?? '')

  const current = computed(
    () => tournamentsStore.items.find((t) => t.id === currentId.value) ?? null
  )

  const tournamentItems = computed<TournamentOption[]>(() =>
    tournamentsStore.items.map((t: TournamentRecord) => ({
      label: t.tournamentName ?? t.id,
      value: t.id,
      avatar: t.tournamentLogo
        ? {
            src: getAssetUrl(t.tournamentLogo),
            alt: t.tournamentName ?? ''
          }
        : undefined
    }))
  )

  watch(
    () => tournamentsStore.items,
    (items) => {
      if (items.length > 0) {
        const exists = items.some((t) => t.id === currentId.value)
        if (!currentId.value || !exists) {
          const nextId = items[0].id
          setCurrent(nextId)
          rendererLogger.info('CurrentTournament', 'Auto-selected first tournament', { nextId })
        }
      }
    },
    { immediate: true }
  )

  function setCurrent(id: string) {
    currentId.value = id
    localStorage.setItem('zh-current-tournament', id)
    rendererLogger.debug('CurrentTournament', 'Current tournament changed', { id })
  }

  return { currentId, current, tournamentItems, setCurrent }
})
