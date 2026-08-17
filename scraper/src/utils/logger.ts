/**
 * utils/logger.ts
 *
 * Structured logging for the scraper service.
 * Prefixes all output with module/university context.
 */

export function createLogger(module: string) {
  const prefix = `[${module}]`;

  return {
    info: (msg: string, ...args: unknown[]) => console.log(`${prefix} ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`${prefix} ⚠ ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`${prefix} ✗ ${msg}`, ...args),
    success: (msg: string, ...args: unknown[]) => console.log(`${prefix} ✓ ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`${prefix} [debug] ${msg}`, ...args);
      }
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
