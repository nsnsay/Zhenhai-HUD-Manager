import { createDatabaseStore } from "./database.factory";
import type { BaseRecord } from "../types/database-store.types";
import type { TournamentFormData } from "@zhenhai/csgogsi/types";

export type TournamentRecord = BaseRecord & TournamentFormData;

export const useTournamentsStore = createDatabaseStore<TournamentRecord>(
  "tournaments",
  "db-tournaments",
);
