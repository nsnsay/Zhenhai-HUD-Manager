import type { CSGO, SettingFormData } from "@zhenhai/csgogsi/types";
import type { DatabaseService } from "../database.service";
import type { GsiMiddleware } from "../gsi-pipeline.service";
import { composeEffectiveSettings, type OverlayEntry } from "../../../shared/overlays";

const APP_SETTINGS_TYPE = "app-settings";

/**
 * 把「生效设置」注入 GSI 载荷。
 *
 * 生效值 = app-settings ⊕ 当前选中 Overlay 的清单默认 ⊕ 用户修改 ⊕ 清单强制覆盖，
 * 与 GET /api/settings 使用同一个 composeEffectiveSettings，保证两条出口不分叉。
 */
function createSettingsEnricher(dbService: DatabaseService): GsiMiddleware {
  return (data: GameState) => {
    if (!data) return data;

    const result = dbService.list("extras", { where: { configType: APP_SETTINGS_TYPE } });
    const appSettings =
      result.success && result.data && result.data.length > 0
        ? ((result.data[0] as { settings?: Record<string, unknown> }).settings ?? null)
        : null;

    const overlays = dbService.list("overlays");
    const selectedId = (() => {
      const extras = dbService.list("extras", { where: { configType: APP_SETTINGS_TYPE } });
      const record = extras.success ? (extras.data?.[0] as { settings?: { selectedOverlayId?: string } }) : undefined;
      return record?.settings?.selectedOverlayId ?? "default";
    })();

    const overlayRecord = overlays.success
      ? (overlays.data as unknown as OverlayEntry[]).find((entry) => entry.overlayId === selectedId) ?? null
      : null;

    const effective = composeEffectiveSettings(appSettings, overlayRecord);

    data.settings = (effective ?? appSettings ?? undefined) as SettingFormData | undefined;

    return data;
  };
}

export default createSettingsEnricher;