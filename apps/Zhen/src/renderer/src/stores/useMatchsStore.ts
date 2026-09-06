import type { BaseRecord } from '@renderer/types/database-store.types'
import { createDatabaseStore } from './database.factory'
import type { MatchsInfo } from '@zhenhai/csgogsi/types'

export type MatchRecord = BaseRecord &
  MatchsInfo & {
    tournamentId: string
  }

export const useMatchsStore = createDatabaseStore<MatchRecord>('matchs', 'db-matchs')
