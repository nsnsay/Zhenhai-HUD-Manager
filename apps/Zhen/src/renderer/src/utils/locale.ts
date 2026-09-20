import type { LanguagePreference } from "@zhenhai/csgogsi/types";

export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-US";

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === "zh-CN" || value === "en-US";
}

/**
 * 语言偏好 → 实际语言。
 *
 * - 明确指定 zh-CN / en-US 时直接使用；
 * - "system" 或非法值时按系统语言判断：zh* → zh-CN，其余回退 en-US。
 */
export function resolveLocale(
  preference: LanguagePreference | undefined | null,
  systemLanguage: string,
): SupportedLocale {
  if (isSupportedLocale(preference)) {
    return preference;
  }

  return systemLanguage?.toLowerCase().startsWith("zh") ? "zh-CN" : DEFAULT_LOCALE;
}