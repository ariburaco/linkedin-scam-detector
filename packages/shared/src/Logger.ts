export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARN = 3,
  ERROR = 4,
}

interface LoggerOptions {
  enableLogger?: boolean;
  isBrowser?: boolean;
  isCloudflareWorker?: boolean;
}

// Environment detection
const isCloudflareWorker =
  typeof globalThis !== "undefined" &&
  "self" in globalThis &&
  typeof (
    globalThis as unknown as { self?: { constructor?: { name?: string } } }
  ).self !== "undefined" &&
  (globalThis as unknown as { self: { constructor: { name: string } } }).self
    .constructor.name === "ServiceWorkerGlobalScope";
const isBrowser =
  typeof globalThis !== "undefined" &&
  "window" in globalThis &&
  typeof (globalThis as unknown as { window?: unknown }).window !== "undefined";

export class Logger {
  private static currentLogLevel: LogLevel =
    process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;

  private static instance: Logger;
  private static defaultContext = "App";

  constructor(
    private context: string = Logger.defaultContext,
    private options: LoggerOptions = {}
  ) {
    // Store environment detection results for potential future use
    // Currently unused but kept for potential environment-specific logging
    if (options.isBrowser !== undefined) {
      void (options.isBrowser ?? isBrowser);
    }
    if (options.isCloudflareWorker !== undefined) {
      void (options.isCloudflareWorker ?? isCloudflareWorker);
    }
    this.options.enableLogger = options.enableLogger ?? true;
  }

  // Static methods
  private static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public static setLogLevel(level: LogLevel) {
    Logger.currentLogLevel = level;
  }

  // Static logging methods
  public static info(message: string, ...args: any[]) {
    Logger.getInstance().info(message, ...args);
  }

  public static error(message: string, ...args: any[]) {
    Logger.getInstance().error(message, ...args);
  }

  public static warn(message: string, ...args: any[]) {
    Logger.getInstance().warn(message, ...args);
  }

  public static debug(message: string, ...args: any[]) {
    Logger.getInstance().debug(message, ...args);
  }

  public static success(message: string, ...args: any[]) {
    Logger.getInstance().success(message, ...args);
  }

  // Instance methods
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(
    level: string,
    message: string,
    ...args: any[]
  ): string {
    const timestamp = this.getTimestamp();
    const formattedArgs = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg
      )
      .join(" ");

    return `[${timestamp}] [${level}] [${this.context}] ${message} ${formattedArgs}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return (
      this.options.enableLogger !== false && level >= Logger.currentLogLevel
    );
  }

  private log(level: string, message: string, ...args: any[]) {
    const logLevel = LogLevel[level as keyof typeof LogLevel];
    if (!this.shouldLog(logLevel)) return;

    const formattedMessage = this.formatMessage(level, message, ...args);

    // Use appropriate console methods for all environments
    // Browser and Cloudflare Workers both support these methods
    switch (level) {
      case "ERROR":
        console.error(formattedMessage);
        break;
      case "WARN":
        console.warn(formattedMessage);
        break;
      case "DEBUG":
        console.debug(formattedMessage);
        break;
      case "INFO":
      case "SUCCESS":
      default:
        console.log(formattedMessage);
        break;
    }
  }

  info(message: string, ...args: any[]) {
    this.log("INFO", message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log("ERROR", message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log("WARN", message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.log("DEBUG", message, ...args);
  }

  success(message: string, ...args: any[]) {
    this.log("SUCCESS", message, ...args);
  }
}
