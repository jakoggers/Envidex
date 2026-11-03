type LogLevel = "info" | "warn" | "error";

interface LogFields {
  provider?: string;
  status?: string | number;
  message?: string;
  latencyMs?: number;
  [key: string]: unknown;
}

const SECRET_KEYS = /secret|token|password|authorization|api[_-]?key|client[_-]?secret/i;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 24 && /[A-Za-z0-9_\-.]{24,}/.test(value)) {
      return "[redacted]";
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...((redact(fields) as LogFields) ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
