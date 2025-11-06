/**
 * HTML to Markdown Conversion Utilities
 * Converts LinkedIn job description HTML to clean Markdown format
 */

import TurndownService from "turndown";
import type { Node } from "turndown";

/**
 * Clean LinkedIn HTML by removing show more/less buttons and unnecessary attributes
 */
export function cleanLinkedInHtml(html: string): string {
  if (!html) return "";

  // For browser environments, use DOM API
  if (typeof window !== "undefined" && window.DOMParser) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.body;

    // Remove show more/less buttons by class name
    const buttons = body.querySelectorAll(
      '.show-more-less-html__button, [class*="show-more-less-html__button"]'
    );
    buttons.forEach((btn: Element) => btn.remove());

    // Remove any elements containing "Show more" or "Show less" text (case-insensitive, language-agnostic)
    const allElements = body.querySelectorAll("*");
    allElements.forEach((el: Element) => {
      const text = el.textContent?.trim().toLowerCase() || "";
      if (
        text.includes("show more") ||
        text.includes("show less") ||
        text.includes("daha fazla") || // Turkish
        text.includes("daha az") || // Turkish
        text.includes("mehr anzeigen") || // German
        text.includes("weniger anzeigen") || // German
        text.includes("voir plus") || // French
        text.includes("voir moins") // French
      ) {
        // Only remove if it's a button or span (common patterns)
        if (
          el.tagName === "BUTTON" ||
          el.tagName === "SPAN" ||
          el.classList.contains("show-more-less-html__button")
        ) {
          el.remove();
        }
      }
    });

    // Strip class attributes from all elements
    const allElementsWithClasses = body.querySelectorAll("[class]");
    allElementsWithClasses.forEach((el: Element) => {
      el.removeAttribute("class");
    });

    // Strip data-* attributes
    const allElementsWithData = body.querySelectorAll("[data-*]");
    allElementsWithData.forEach((el: Element) => {
      Array.from(el.attributes).forEach((attr: Attr) => {
        if (attr.name.startsWith("data-")) {
          el.removeAttribute(attr.name);
        }
      });
    });

    // Remove empty elements
    const emptyElements = body.querySelectorAll("*");
    emptyElements.forEach((el: Element) => {
      if (
        el.children.length === 0 &&
        (!el.textContent || el.textContent.trim() === "")
      ) {
        el.remove();
      }
    });

    return body.innerHTML;
  }

  // For Node.js environments, use regex-based cleaning (less precise but works)
  let cleaned = html;

  // Remove show more/less buttons (regex pattern for common structures)
  cleaned = cleaned.replace(
    /<[^>]*class="[^"]*show-more-less-html__button[^"]*"[^>]*>.*?<\/[^>]+>/gi,
    ""
  );

  // Remove elements containing "Show more" or "Show less" text
  cleaned = cleaned.replace(
    /<(button|span)[^>]*>.*?(show\s+more|show\s+less|daha\s+fazla|daha\s+az|mehr\s+anzeigen|weniger\s+anzeigen|voir\s+plus|voir\s+moins).*?<\/\1>/gi,
    ""
  );

  // Strip class attributes
  cleaned = cleaned.replace(/\s*class="[^"]*"/gi, "");

  // Strip data-* attributes
  cleaned = cleaned.replace(/\s*data-[^=]*="[^"]*"/gi, "");

  return cleaned;
}

/**
 * Convert HTML to Markdown using Turndown
 */
export function convertHtmlToMarkdown(html: string): string {
  if (!html) return "";

  // Clean the HTML first
  const cleanedHtml = cleanLinkedInHtml(html);

  // Initialize Turndown service with custom options
  const turndownService = new TurndownService({
    headingStyle: "atx", // Use # for headings
    codeBlockStyle: "fenced", // Use ``` for code blocks
    bulletListMarker: "-", // Use - for bullet lists
    emDelimiter: "*", // Use * for emphasis
    strongDelimiter: "**", // Use ** for strong
    linkStyle: "inlined", // Use inline links [text](url)
    linkReferenceStyle: "full", // Use full reference links
  });

  // Add custom rules for better LinkedIn HTML handling
  turndownService.addRule("preserveLineBreaks", {
    filter: (node: Node) => {
      const element = node as Element;
      return (
        node.nodeName === "BR" ||
        (node.nodeName === "P" && element.textContent?.trim() === "")
      );
    },
    replacement: () => {
      return "\n\n";
    },
  });

  // Handle empty paragraphs (just line breaks)
  turndownService.addRule("emptyParagraphs", {
    filter: (node: Node) => {
      const element = node as Element;
      return (
        node.nodeName === "P" &&
        (!element.textContent || element.textContent.trim() === "") &&
        element.children.length === 0
      );
    },
    replacement: () => {
      return "\n";
    },
  });

  // Convert HTML to Markdown
  let markdown = turndownService.turndown(cleanedHtml);

  // Post-process cleanup
  // Remove excessive blank lines (more than 2 consecutive)
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // Clean up trailing whitespace
  markdown = markdown.trim();

  return markdown;
}
