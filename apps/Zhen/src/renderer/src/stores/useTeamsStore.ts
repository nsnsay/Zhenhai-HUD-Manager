import { createDatabaseStore } from "./database.factory";
import type { BaseRecord } from "../types/database-store.types";
import type { TeamFormData } from "@zhenhai/csgogsi/types";

export type TeamRecord = BaseRecord &
  TeamFormData & {
    tournamentId: string;
  };

export const useTeamsStore = createDatabaseStore<TeamRecord>("teams", "db-teams");
