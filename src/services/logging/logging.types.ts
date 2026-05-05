export type LogFunction = (...args: unknown[]) => void;

export interface LoggerType {
  fatal: LogFunction;
  error: LogFunction;
  warn: LogFunction;
  info: LogFunction;
  debug: LogFunction;
  trace: LogFunction;
};