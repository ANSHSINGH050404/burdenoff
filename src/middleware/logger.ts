export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, string | number | boolean | null>;

export type Logger = {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
};

export function parseLogLevel(value: string | undefined): LogLevel {
  if (value === 'debug' || value === 'warn' || value === 'error') return value;
  return 'info';
}

/**
 * JSON-line logger writing to stdout. One line per event:
 * {"time":"...","level":"info","msg":"request","status":200,...}
 */
export function createLogger(
  level: LogLevel = parseLogLevel(process.env.LOG_LEVEL),
  sink: (line: string) => void = (line) => console.log(line),
): Logger {
  function write(logLevel: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_WEIGHT[logLevel] < LEVEL_WEIGHT[level]) return;
    sink(
      JSON.stringify({ time: new Date().toISOString(), level: logLevel, msg: message, ...fields }),
    );
  }
  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}
