import type { CrudResult, QueryOptions } from './api.types.ts'
import type { DatabaseRecord } from '../../../shared/ipc'

export type BaseRecord = DatabaseRecord

export interface DatabaseStore<T extends BaseRecord = BaseRecord> {
  items: T[]
  isLoading: boolean
  error: string | null

  init(): Promise<void>
  fetchList(options?: QueryOptions): Promise<void>
  create(data: Omit<T, keyof BaseRecord>): Promise<CrudResult<T>>
  update(id: string, data: Partial<Omit<T, keyof BaseRecord>>): Promise<CrudResult<T>>
  remove(id: string): Promise<CrudResult<{ id: string }>>
  getById(id: string): T | undefined
}
