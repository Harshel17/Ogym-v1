type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  enabledInProduction?: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';

function formatMessage(level: LogLevel, prefix: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const prefixStr = prefix ? `[${prefix}]` : '';
  return `${timestamp} [${level.toUpperCase()}]${prefixStr}`;
}

function shouldLog(level: LogLevel, enabledInProduction: boolean): boolean {
  if (level === 'error' || level === 'warn') {
    return true;
  }
  if (isProduction && !enabledInProduction) {
    return level !== 'debug';
  }
  return true;
}

class Logger {
  private prefix: string;
  private enabledInProduction: boolean;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || '';
    this.enabledInProduction = options.enabledInProduction ?? false;
  }

  debug(...args: unknown[]) {
    if (!shouldLog('debug', this.enabledInProduction)) return;
    if (isProduction) return;
    console.debug(formatMessage('debug', this.prefix), ...args);
  }

  info(...args: unknown[]) {
    if (!shouldLog('info', this.enabledInProduction)) return;
    console.log(formatMessage('info', this.prefix), ...args);
  }

  warn(...args: unknown[]) {
    console.warn(formatMessage('warn', this.prefix), ...args);
  }

  error(...args: unknown[]) {
    console.error(formatMessage('error', this.prefix), ...args);
  }

  child(prefix: string): Logger {
    const combinedPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({ prefix: combinedPrefix, enabledInProduction: this.enabledInProduction });
  }
}

export const logger = new Logger();

export function createLogger(prefix: string): Logger {
  return new Logger({ prefix });
}
