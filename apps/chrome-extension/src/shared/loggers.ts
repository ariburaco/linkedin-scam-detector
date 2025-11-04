import { Logger } from "@acme/shared/Logger";

const IS_DEV = process.env.NODE_ENV === "development";

export const extensionLoggerContent = new Logger("ChromeExtContent", {
  isBrowser: true,
  enableLogger: IS_DEV,
});

export const extensionLoggerBackground = new Logger("ChromeExtBackground", {
  isBrowser: true,
  enableLogger: IS_DEV,
});

export const extensionLoggerContentInjected = new Logger(
  "ChromeExtContentInjected",
  {
    isBrowser: true,
    enableLogger: IS_DEV,
  }
);
