import type { CSGO, SettingFormData } from "@zhenhai/csgogsi/types";
import type { DatabaseService } from "../database.service";
import type { GsiMiddleware } from "../gsi-pipeline.service";

function createSettingsEnricher(dbService: DatabaseService): GsiMiddleware {
  return (data: CSGO) => {
    if (!data) return data;

    const result = dbService.list("extras", { where: { configType: "app-settings" } });

    if (result.success && result.data && result.data.length > 0) {
      const record = result.data[0] as unknown as SettingFormData & {
        settings?: SettingFormData;
      };

      data.settings = record.settings ?? (record as SettingFormData);
    } else {
      data.settings = undefined;
    }

    return data;
  };
}

export default createSettingsEnricher;
