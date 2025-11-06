#!/usr/bin/env bun

/**
 * Check LinkedIn Authentication Status
 * Verifies if cookies are properly stored and authentication is valid
 */

import { LinkedInCookiesService } from "../packages/api/src/services/linkedin-cookies.service";

async function main() {
  try {
    console.log("🔍 Checking LinkedIn authentication status...\n");

    // Check authentication
    const isAuthenticated = await LinkedInCookiesService.isAuthenticated();
    
    if (isAuthenticated) {
      console.log("✅ Authentication status: Valid (li_at cookie present and not expired)");
    } else {
      console.log("⚠️  Authentication status: Invalid or missing li_at cookie");
    }

    // Get li_at cookie specifically
    const liAtCookie = await LinkedInCookiesService.getCookieByName("li_at");
    if (liAtCookie) {
      console.log("\n📋 li_at cookie details:");
      console.log(`   - Domain: ${liAtCookie.domain}`);
      console.log(`   - Path: ${liAtCookie.path}`);
      console.log(`   - Expires: ${liAtCookie.expires ? new Date(liAtCookie.expires * 1000).toISOString() : "Session"}`);
      console.log(`   - HttpOnly: ${liAtCookie.httpOnly}`);
      console.log(`   - Secure: ${liAtCookie.secure}`);
      console.log(`   - Value: ${liAtCookie.value.substring(0, 20)}...`);
    } else {
      console.log("\n❌ li_at cookie not found in database");
    }

    // Get all cookies count
    const allCookies = await LinkedInCookiesService.getCookies();
    console.log(`\n📊 Total valid cookies: ${allCookies.length}`);

    process.exit(isAuthenticated ? 0 : 1);
  } catch (error) {
    console.error("❌ Failed to check authentication", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

