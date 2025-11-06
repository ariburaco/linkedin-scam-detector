#!/usr/bin/env bun

/**
 * LinkedIn Cookie Import Script
 * Imports cookies from Chrome DevTools or export formats into the database
 * 
 * Usage:
 *   bun scripts/import-linkedin-cookies.ts <cookie-data>
 *   bun scripts/import-linkedin-cookies.ts --file cookies.json
 *   echo "<cookie-data>" | bun scripts/import-linkedin-cookies.ts
 */

import { readFile } from "fs/promises";
import { stdin } from "process";
import {
  parseChromeDevToolsCookies,
  parseChromeExportCookies,
  parseNetscapeCookies,
  validateCookies,
  formatCookiesForPuppeteer,
} from "../packages/scraper/src/cookie-utils";
import { LinkedInCookiesService } from "../packages/api/src/services/linkedin-cookies.service";

async function readInput(): Promise<string> {
  const args = process.argv.slice(2);

  // Check for --file flag
  const fileIndex = args.indexOf("--file");
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    const filePath = args[fileIndex + 1];
    console.log(`Reading cookies from file: ${filePath}`);
    return await readFile(filePath, "utf-8");
  }

  // Check for direct argument
  if (args.length > 0 && !args[0].startsWith("--")) {
    return args.join(" ");
  }

  // Read from stdin
  return new Promise((resolve) => {
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      data += chunk;
    });
    stdin.on("end", () => {
      resolve(data);
    });
    stdin.on("error", (err) => {
      console.error("Error reading from stdin:", err);
      process.exit(1);
    });
  });
}

async function main() {
  try {
    console.log("🍪 LinkedIn Cookie Importer\n");

    // Read input
    const input = await readInput();
    if (!input || !input.trim()) {
      console.error("❌ No cookie data provided");
      console.log("\nUsage:");
      console.log("  bun scripts/import-linkedin-cookies.ts <cookie-data>");
      console.log("  bun scripts/import-linkedin-cookies.ts --file cookies.json");
      console.log("  echo '<cookie-data>' | bun scripts/import-linkedin-cookies.ts");
      process.exit(1);
    }

    // Try different parsing methods
    let cookies;
    let parseMethod = "";

    // Try Chrome export JSON format first
    try {
      cookies = parseChromeExportCookies(input);
      parseMethod = "Chrome Export JSON";
    } catch {
      // Try Chrome DevTools format
      try {
        cookies = parseChromeDevToolsCookies(input);
        parseMethod = "Chrome DevTools";
      } catch {
        // Try Netscape format
        try {
          cookies = parseNetscapeCookies(input);
          parseMethod = "Netscape";
        } catch (error) {
          console.error("❌ Failed to parse cookies");
          console.error("Error:", error instanceof Error ? error.message : String(error));
          console.log("\nSupported formats:");
          console.log("  1. Chrome DevTools: Copy-paste from Application > Cookies table");
          console.log("  2. Chrome Export: JSON export from Chrome");
          console.log("  3. Netscape: Netscape cookie file format");
          process.exit(1);
        }
      }
    }

    if (cookies.length === 0) {
      console.error("❌ No cookies found in input");
      process.exit(1);
    }

    console.log(`✓ Parsed ${cookies.length} cookies using ${parseMethod} format`);

    // Filter LinkedIn cookies only
    const linkedinCookies = cookies.filter((cookie) =>
      cookie.domain.includes("linkedin.com")
    );

    if (linkedinCookies.length === 0) {
      console.error("❌ No LinkedIn cookies found");
      console.log("Make sure the cookies are for linkedin.com domain");
      process.exit(1);
    }

    console.log(`✓ Found ${linkedinCookies.length} LinkedIn cookies`);

    // Validate cookies
    const validation = validateCookies(linkedinCookies);
    if (!validation.valid) {
      console.warn("⚠️  Validation warnings:");
      validation.errors.forEach((error) => console.warn(`   - ${error}`));
      
      // Ask for confirmation
      console.log("\n⚠️  Some cookies have issues. Continue anyway? (y/n)");
      // For non-interactive mode, continue with warnings
    }

    // Format for Puppeteer
    const formattedCookies = formatCookiesForPuppeteer(linkedinCookies);

    // Store in database
    console.log("\n💾 Storing cookies in database...");
    await LinkedInCookiesService.setCookies(formattedCookies);

    console.log("✅ Successfully imported cookies!");
    console.log(`   - Total cookies: ${formattedCookies.length}`);
    console.log(`   - Domains: ${[...new Set(formattedCookies.map((c) => c.domain))].join(", ")}`);

    // Check authentication status
    const isAuthenticated = await LinkedInCookiesService.isAuthenticated();
    if (isAuthenticated) {
      console.log("✅ Authentication status: Valid (li_at cookie present)");
    } else {
      console.warn("⚠️  Authentication status: Invalid or missing li_at cookie");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to import cookies");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("\nStack:", error.stack);
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

