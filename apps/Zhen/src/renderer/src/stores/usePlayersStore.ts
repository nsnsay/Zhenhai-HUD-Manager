import { createDatabaseStore } from './database.factory'
import type { BaseRecord } from '../types/database-store.types'
import type { PlayerFormData } from '@zhenhai/csgogsi/types'

export type PlayerRecord = BaseRecord &
  PlayerFormData & {
    tournamentId: string
  }
export const usePlayersStore = createDatabaseStore<PlayerRecord>('players', 'db-players')
