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
        text === "show more" ||
        text === "show less" ||
        text === "show more show less" ||
        text.includes("show more") ||
        text.includes("show less") ||
        text.includes("daha fazla") || // Turkish
        text.includes("daha az") || // Turkish
        text.includes("mehr anzeigen") || // German
        text.includes("weniger anzeigen") || // German
        text.includes("voir plus") || // French
        text.includes("voir moins") // French
      ) {
        // Remove if it's a button, span, or if the entire text content matches the pattern
        if (
          el.tagName === "BUTTON" ||
          el.tagName === "SPAN" ||
          el.classList.contains("show-more-less-html__button") ||
          text === "show more" ||
          text === "show less" ||
          text === "show more show less"
        ) {
          el.remove();
        }
      }
    });

    // Also remove text nodes that contain "Show more" / "Show less" patterns
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
    let node: globalThis.Node | null;
    const nodesToRemove: globalThis.Node[] = [];
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim().toLowerCase() || "";
      if (
        text === "show more" ||
        text === "show less" ||
        text === "show more show less" ||
        text.includes("show more show less")
      ) {
        nodesToRemove.push(node);
      }
    }
    nodesToRemove.forEach((n) => {
      if (n.parentNode) {
        n.parentNode.removeChild(n);
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

  // Remove standalone "Show more Show less" text patterns (not in tags)
  cleaned = cleaned.replace(/\s*show\s+more\s+show\s+less\s*/gi, "");
  cleaned = cleaned.replace(/\s*show\s+more\s*/gi, "");
  cleaned = cleaned.replace(/\s*show\s+less\s*/gi, "");

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
  // Handle <br> tags - convert to double newlines for proper paragraph breaks
  turndownService.addRule("lineBreaks", {
    filter: (node: Node) => {
      return node.nodeName === "BR";
    },
    replacement: () => {
      return "\n\n";
    },
  });

  // Handle empty paragraphs
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

  // Post-process cleanup and formatting improvements
  // Remove "Show more" / "Show less" text patterns (case-insensitive, language-agnostic)
  const showMoreLessPatterns = [
    /\s*show\s+more\s+show\s+less\s*/gi,
    /\s*show\s+more\s*/gi,
    /\s*show\s+less\s*/gi,
    /\s*daha\s+fazla\s+daha\s+az\s*/gi, // Turkish
    /\s*daha\s+fazla\s*/gi, // Turkish
    /\s*daha\s+az\s*/gi, // Turkish
    /\s*mehr\s+anzeigen\s+weniger\s+anzeigen\s*/gi, // German
    /\s*mehr\s+anzeigen\s*/gi, // German
    /\s*weniger\s+anzeigen\s*/gi, // German
    /\s*voir\s+plus\s+voir\s+moins\s*/gi, // French
    /\s*voir\s+plus\s*/gi, // French
    /\s*voir\s+moins\s*/gi, // French
  ];

  for (const pattern of showMoreLessPatterns) {
    markdown = markdown.replace(pattern, "");
  }

  // Convert common section headers (bold text at start of line) to markdown headings
  // Pattern: **Text** or **Text:** at start of line (standalone) -> ## Text
  // Only convert if it's a standalone line (not part of a paragraph)
  // Examples: "**Responsibilities**" -> "## Responsibilities"
  //           "**We are looking for…**" -> "## We are looking for…"
  markdown = markdown.replace(/^\*\*([^*]+?):?\*\*\s*$/gm, "## $1");

  // Normalize line endings (ensure consistent \n)
  markdown = markdown.replace(/\r\n/g, "\n");
  markdown = markdown.replace(/\r/g, "\n");

  // Remove excessive whitespace (more than 2 spaces) - but preserve intentional spacing
  // Only collapse spaces within lines, not line breaks
  markdown = markdown.replace(/[ \t]{3,}/g, "  ");

  // Ensure proper spacing around lists
  // Add blank line before lists if missing (but not if already preceded by blank line or heading)
  markdown = markdown.replace(/([^\n#])\n([-*+] )/g, "$1\n\n$2");
  markdown = markdown.replace(/([^\n#])\n(\d+\. )/g, "$1\n\n$2");

  // Ensure proper spacing after lists (but not if followed by another list item, blank line, or heading)
  markdown = markdown.replace(/([-*+] .+)\n([^\n-*+\d#\s])/g, "$1\n\n$2");
  markdown = markdown.replace(/(\d+\. .+)\n([^\n-*+\d#\s])/g, "$1\n\n$2");

  // Ensure proper spacing around headings
  markdown = markdown.replace(/([^\n#])\n(#{1,6} )/g, "$1\n\n$2");
  markdown = markdown.replace(/(#{1,6} .+)\n([^\n#])/g, "$1\n\n$2");

  // Clean up multiple consecutive blank lines (more than 2)
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // Remove trailing whitespace from each line
  markdown = markdown.replace(/[ \t]+$/gm, "");

  // Clean up leading/trailing whitespace from entire document
  markdown = markdown.trim();

  // Ensure document ends with a single newline
  if (markdown && !markdown.endsWith("\n")) {
    markdown += "\n";
  }

  return markdown;
}
