import { apiUrl } from './apiUrl'

type HaiLoggerLevel = 'error' | 'warn' | 'info' | 'debug'

interface HaiLoggerPayload {
  level: HaiLoggerLevel
  source: string
  message: string
  meta?: unknown
}

interface HaiWindowApi {
  logger?: {
    log: (payload: HaiLoggerPayload) => Promise<unknown>
  }
}

interface HaiPreloadWindow extends Window {
  api?: HaiWindowApi
}

const LOG_ENDPOINT = `${apiUrl()}/logger`

function normalizeMeta(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }

  return value
}

async function sendLog(payload: HaiLoggerPayload): Promise<void> {
  const windowApi = (window as HaiPreloadWindow).api

  if (windowApi?.logger?.log) {
    try {
      await windowApi.logger.log(payload)
      return
    } catch {
      // Fall through to the Express API when IPC is unavailable.
    }
  }

  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    // Ignore logging failures; HUD rendering must never depend on logs.
  }
}

export const haiLogger = {
  error(source: string, message: string, meta?: unknown) {
    void sendLog({ level: 'error', source, message, meta: normalizeMeta(meta) })
  },
  warn(source: string, message: string, meta?: unknown) {
    void sendLog({ level: 'warn', source, message, meta: normalizeMeta(meta) })
  },
  info(source: string, message: string, meta?: unknown) {
    void sendLog({ level: 'info', source, message, meta: normalizeMeta(meta) })
  },
  debug(source: string, message: string, meta?: unknown) {
    void sendLog({ level: 'debug', source, message, meta: normalizeMeta(meta) })
  },
}
