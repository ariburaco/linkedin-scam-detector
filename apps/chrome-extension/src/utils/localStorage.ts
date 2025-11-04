import { EXTENSION_NAME } from "@/constants/constants";
import superjson from "superjson";

const STORAGE_PREFIX = `${EXTENSION_NAME}-`;

export class LocalStorage {
  static setItem<T>(key: string, value: T): void {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const serializedValue = superjson.stringify(value);
      localStorage.setItem(prefixedKey, serializedValue);
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }

  static getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const item = localStorage.getItem(prefixedKey);

      if (item === null) {
        return defaultValue ?? null;
      }

      return superjson.parse<T>(item);
    } catch (error) {
      console.error(`Error getting localStorage key "${key}":`, error);
      return defaultValue ?? null;
    }
  }

  static removeItem(key: string): void {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      localStorage.removeItem(prefixedKey);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }

  static clear(): void {
    try {
      // Only clear items with our prefix
      Object.keys(localStorage)
        .filter((key) => key.startsWith(STORAGE_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error("Error clearing localStorage:", error);
    }
  }

  static getAllKeys(): string[] {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .map((key) => key.replace(STORAGE_PREFIX, ""));
  }
}
