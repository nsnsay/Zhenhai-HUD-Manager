import type { LoggerLevel, LoggerPayload } from "../../../shared/ipc";

export function rendererLog(
  level: LoggerLevel,
  source: string,
  message: string,
  meta?: unknown,
): void {
  const payload: LoggerPayload = { level, source, message, meta };

  window.api?.logger.log(payload).catch(() => {
    // Keep renderer behavior independent of log transport availability.
  });
}

export const rendererLogger = {
  error(source: string, message: string, meta?: unknown) {
    rendererLog("error", source, message, meta);
  },
  warn(source: string, message: string, meta?: unknown) {
    rendererLog("warn", source, message, meta);
  },
  info(source: string, message: string, meta?: unknown) {
    rendererLog("info", source, message, meta);
  },
  debug(source: string, message: string, meta?: unknown) {
    rendererLog("debug", source, message, meta);
  },
};
