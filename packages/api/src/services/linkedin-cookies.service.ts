/**
 * LinkedIn Cookies Service
 * Manages LinkedIn authentication cookies in the database
 */

import prisma from "@acme/db";
import { Logger } from "@acme/shared/Logger";

export interface LinkedInCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number; // Unix timestamp in seconds
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

const logger = new Logger("LinkedInCookiesService");

export class LinkedInCookiesService {
  /**
   * Get all LinkedIn cookies from database
   * Converts to Puppeteer format
   */
  static async getCookies(): Promise<LinkedInCookie[]> {
    try {
      const dbCookies = await prisma.linkedInCookie.findMany({
        where: {
          OR: [
            { domain: ".linkedin.com" },
            { domain: ".www.linkedin.com" },
            { domain: "www.linkedin.com" },
            { domain: "linkedin.com" },
          ],
        },
        orderBy: { name: "asc" },
      });

      // Filter out expired cookies
      const now = new Date();
      const validCookies = dbCookies.filter((cookie) => {
        if (!cookie.expires) {
          return true; // Session cookies don't expire
        }
        return new Date(cookie.expires) > now;
      });

      // Convert to Puppeteer format
      const cookies: LinkedInCookie[] = validCookies.map((cookie) => {
        const formatted: LinkedInCookie = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires ? Math.floor(cookie.expires.getTime() / 1000) : undefined,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
        };

        // Only include sameSite if it's a valid string value (not null)
        if (cookie.sameSite && ['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
          formatted.sameSite = cookie.sameSite as "Strict" | "Lax" | "None";
        }

        return formatted;
      });

      logger.info("Retrieved LinkedIn cookies", {
        total: dbCookies.length,
        valid: cookies.length,
        expired: dbCookies.length - cookies.length,
      });

      return cookies;
    } catch (error) {
      logger.error("Failed to get LinkedIn cookies", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  /**
   * Set/update LinkedIn cookies
   * Upserts cookies (updates if exists, creates if new)
   */
  static async setCookies(cookies: LinkedInCookie[]): Promise<void> {
    try {
      logger.info("Setting LinkedIn cookies", { count: cookies.length });

      for (const cookie of cookies) {
        const expiresDate = cookie.expires
          ? new Date(cookie.expires * 1000)
          : null;

        await prisma.linkedInCookie.upsert({
          where: {
            name_domain: {
              name: cookie.name,
              domain: cookie.domain || ".linkedin.com",
            },
          },
          update: {
            value: cookie.value,
            path: cookie.path || "/",
            expires: expiresDate,
            httpOnly: cookie.httpOnly ?? false,
            secure: cookie.secure ?? true,
            sameSite: cookie.sameSite ?? null,
            updatedAt: new Date(),
          },
          create: {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || ".linkedin.com",
            path: cookie.path || "/",
            expires: expiresDate,
            httpOnly: cookie.httpOnly ?? false,
            secure: cookie.secure ?? true,
            sameSite: cookie.sameSite ?? null,
          },
        });
      }

      logger.info("LinkedIn cookies set successfully", {
        count: cookies.length,
      });
    } catch (error) {
      logger.error("Failed to set LinkedIn cookies", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Clear all LinkedIn cookies
   */
  static async clearCookies(): Promise<void> {
    try {
      const result = await prisma.linkedInCookie.deleteMany({
        where: {
          OR: [
            { domain: ".linkedin.com" },
            { domain: ".www.linkedin.com" },
            { domain: "www.linkedin.com" },
            { domain: "linkedin.com" },
          ],
        },
      });

      logger.info("Cleared LinkedIn cookies", {
        deleted: result.count,
      });
    } catch (error) {
      logger.error("Failed to clear LinkedIn cookies", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Check if authenticated (has valid li_at cookie)
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const liAtCookie = await prisma.linkedInCookie.findFirst({
        where: {
          name: "li_at",
          OR: [
            { domain: ".linkedin.com" },
            { domain: ".www.linkedin.com" },
            { domain: "www.linkedin.com" },
            { domain: "linkedin.com" },
          ],
        },
      });

      if (!liAtCookie) {
        return false;
      }

      // Check if expired
      if (liAtCookie.expires) {
        const now = new Date();
        if (new Date(liAtCookie.expires) <= now) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error("Failed to check authentication status", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Get specific cookie by name
   */
  static async getCookieByName(name: string): Promise<LinkedInCookie | null> {
    try {
      const dbCookie = await prisma.linkedInCookie.findFirst({
        where: {
          name,
          OR: [
            { domain: ".linkedin.com" },
            { domain: ".www.linkedin.com" },
            { domain: "www.linkedin.com" },
            { domain: "linkedin.com" },
          ],
        },
      });

      if (!dbCookie) {
        return null;
      }

      // Check if expired
      if (dbCookie.expires) {
        const now = new Date();
        if (new Date(dbCookie.expires) <= now) {
          return null;
        }
      }

      return {
        name: dbCookie.name,
        value: dbCookie.value,
        domain: dbCookie.domain,
        path: dbCookie.path,
        expires: dbCookie.expires
          ? Math.floor(dbCookie.expires.getTime() / 1000)
          : undefined,
        httpOnly: dbCookie.httpOnly,
        secure: dbCookie.secure,
        sameSite: dbCookie.sameSite as "Strict" | "Lax" | "None" | undefined,
      };
    } catch (error) {
      logger.error("Failed to get cookie by name", {
        name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }
}

