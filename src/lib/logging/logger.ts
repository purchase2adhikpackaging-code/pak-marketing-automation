const REDACTED_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "cookie",
  "apiKey",
  "api_key",
  "secret",
  "serviceRoleKey",
  "service_role_key",
]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        REDACTED_KEYS.has(key) ? "[REDACTED]" : redactValue(nested),
      ]),
    );
  }
  return value;
}

export type LogContext = Record<string, unknown>;

export const logger = {
  info(message: string, context: LogContext = {}) {
    console.info(JSON.stringify({ level: "info", message, ...redactValue(context) as object }));
  },
  warn(message: string, context: LogContext = {}) {
    console.warn(JSON.stringify({ level: "warn", message, ...redactValue(context) as object }));
  },
  error(message: string, context: LogContext = {}) {
    console.error(JSON.stringify({ level: "error", message, ...redactValue(context) as object }));
  },
};
