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
    // Pre-clean: Remove Angular comment markers and normalize HTML
    const preCleaned = html
      // Remove Angular comment markers (<!---->)
      .replace(/<!---->/g, "")
      // Remove empty span wrappers that just contain whitespace
      .replace(/<span>\s*<\/span>/g, "")
      // Normalize whitespace in HTML
      .replace(/\s+/g, " ")
      .trim();

    const parser = new DOMParser();
    let doc: Document;
    try {
      doc = parser.parseFromString(preCleaned, "text/html");
    } catch (error) {
      // If parsing fails, try with a wrapper div
      console.debug(
        "[HTML Cleaner] Initial parse failed, trying with wrapper:",
        error
      );
      try {
        doc = parser.parseFromString(`<div>${preCleaned}</div>`, "text/html");
      } catch (fallbackError) {
        // Last resort: return cleaned HTML string
        console.error("[HTML Cleaner] Failed to parse HTML:", fallbackError);
        return preCleaned;
      }
    }
    const body = doc.body;
    if (!body) {
      console.error("[HTML Cleaner] No body element found in parsed document");
      return preCleaned;
    }

    // Wrap all DOM manipulation in a try-catch to handle DOMExceptions
    try {
      // Remove show more/less buttons by class name
      try {
        const buttons = body.querySelectorAll(
          '.show-more-less-html__button, [class*="show-more-less-html__button"]'
        );
        buttons.forEach((btn: Element) => {
          try {
            btn.remove();
          } catch (e) {
            // Ignore individual removal errors
            console.debug("[HTML Cleaner] Failed to remove button:", e);
          }
        });
      } catch (error) {
        console.debug("[HTML Cleaner] Failed to remove buttons:", error);
      }

      // Remove any elements containing "Show more" or "Show less" text (case-insensitive, language-agnostic)
      try {
        const allElements = body.querySelectorAll("*");
        allElements.forEach((el: Element) => {
          try {
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
          } catch (e) {
            // Ignore individual element processing errors
            console.debug("[HTML Cleaner] Failed to process element:", e);
          }
        });
      } catch (error) {
        console.debug(
          "[HTML Cleaner] Failed to remove show more/less elements:",
          error
        );
      }

      // Also remove text nodes that contain "Show more" / "Show less" patterns
      try {
        const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
        let node: globalThis.Node | null;
        const nodesToRemove: globalThis.Node[] = [];
        while ((node = walker.nextNode())) {
          try {
            const text = node.textContent?.trim().toLowerCase() || "";
            if (
              text === "show more" ||
              text === "show less" ||
              text === "show more show less" ||
              text.includes("show more show less")
            ) {
              nodesToRemove.push(node);
            }
          } catch (e) {
            // Ignore individual node processing errors
            console.debug("[HTML Cleaner] Failed to process text node:", e);
          }
        }
        nodesToRemove.forEach((n) => {
          try {
            if (n.parentNode) {
              n.parentNode.removeChild(n);
            }
          } catch (e) {
            // Ignore individual removal errors
            console.debug("[HTML Cleaner] Failed to remove text node:", e);
          }
        });
      } catch (error) {
        console.debug("[HTML Cleaner] Failed to remove text nodes:", error);
      }

      // Strip class attributes from all elements
      try {
        const allElementsWithClasses = body.querySelectorAll("[class]");
        allElementsWithClasses.forEach((el: Element) => {
          try {
            el.removeAttribute("class");
          } catch (e) {
            // Ignore individual attribute removal errors
            console.debug(
              "[HTML Cleaner] Failed to remove class attribute:",
              e
            );
          }
        });
      } catch (error) {
        console.debug(
          "[HTML Cleaner] Failed to strip class attributes:",
          error
        );
      }

      // Strip data-* attributes
      // Note: CSS selector [data-*] is invalid, so we need to iterate all elements
      try {
        const allElements = body.querySelectorAll("*");
        allElements.forEach((el: Element) => {
          try {
            // Get all attributes and filter for data-* ones
            const attrsToRemove: string[] = [];
            Array.from(el.attributes).forEach((attr: Attr) => {
              if (attr.name.startsWith("data-")) {
                attrsToRemove.push(attr.name);
              }
            });
            // Remove data attributes
            attrsToRemove.forEach((attrName) => {
              try {
                el.removeAttribute(attrName);
              } catch (e) {
                // Ignore individual attribute removal errors
                console.debug(
                  "[HTML Cleaner] Failed to remove data attribute:",
                  e
                );
              }
            });
          } catch (e) {
            // Ignore element processing errors
            console.debug(
              "[HTML Cleaner] Failed to process element attributes:",
              e
            );
          }
        });
      } catch (error) {
        console.debug("[HTML Cleaner] Failed to strip data attributes:", error);
      }

      // Remove empty elements
      try {
        const emptyElements = body.querySelectorAll("*");
        emptyElements.forEach((el: Element) => {
          try {
            if (
              el.children.length === 0 &&
              (!el.textContent || el.textContent.trim() === "")
            ) {
              el.remove();
            }
          } catch (e) {
            // Ignore individual removal errors
            console.debug("[HTML Cleaner] Failed to remove empty element:", e);
          }
        });
      } catch (error) {
        console.debug("[HTML Cleaner] Failed to remove empty elements:", error);
      }

      // Flatten nested span/p structures (LinkedIn often wraps content in unnecessary spans)
      // Example: <span><p>text</p></span> -> <p>text</p>
      try {
        const nestedSpans = body.querySelectorAll(
          "span > p, span > ul, span > ol"
        );
        nestedSpans.forEach((child: Element) => {
          try {
            const parent = child.parentElement;
            if (
              parent &&
              parent.tagName === "SPAN" &&
              parent.children.length === 1
            ) {
              // If span only contains this child, unwrap it
              const grandparent = parent.parentElement;
              if (grandparent) {
                grandparent.insertBefore(child, parent);
                parent.remove();
              }
            }
          } catch (e) {
            // Ignore individual unwrapping errors
            console.debug("[HTML Cleaner] Failed to unwrap nested span:", e);
          }
        });
      } catch (error) {
        console.debug(
          "[HTML Cleaner] Failed to flatten nested structures:",
          error
        );
      }

      // Remove remaining empty spans (manually check since :has() may not be supported)
      try {
        const allSpans = body.querySelectorAll("span");
        allSpans.forEach((span: Element) => {
          try {
            // Check if span is truly empty (no children and no meaningful text)
            if (
              span.children.length === 0 &&
              (!span.textContent || span.textContent.trim() === "")
            ) {
              span.remove();
            }
          } catch (e) {
            // Ignore individual removal errors
            console.debug("[HTML Cleaner] Failed to remove empty span:", e);
          }
        });
      } catch (error) {
        console.debug("[HTML Cleaner] Failed to remove empty spans:", error);
      }

      // Final step: return cleaned HTML
      try {
        return body.innerHTML;
      } catch (error) {
        console.error("[HTML Cleaner] Failed to get innerHTML:", error);
        // Fallback: return text content
        return body.textContent || "";
      }
    } catch (domError) {
      // If any DOM manipulation fails, return pre-cleaned HTML
      // This preserves Angular comment removal and basic cleaning
      console.error(
        "[HTML Cleaner] DOM manipulation failed, returning pre-cleaned HTML:",
        {
          error: domError,
          errorMessage:
            domError instanceof Error ? domError.message : String(domError),
          errorName:
            domError instanceof Error ? domError.name : typeof domError,
        }
      );
      return preCleaned;
    }
  }

  // For Node.js environments, use regex-based cleaning (less precise but works)
  let cleaned = html;

  // Remove Angular comment markers (<!---->)
  cleaned = cleaned.replace(/<!---->/g, "");

  // Remove empty span wrappers
  cleaned = cleaned.replace(/<span>\s*<\/span>/g, "");
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/g, "");

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
  let cleanedHtml: string;
  try {
    cleanedHtml = cleanLinkedInHtml(html);
  } catch (error) {
    console.error("[HTML to Markdown] Failed to clean HTML:", error);
    // Fallback: strip HTML tags and return plain text
    return html.replace(/<[^>]*>/g, "").trim();
  }

  // Initialize Turndown service with custom options
  let turndownService: TurndownService;
  try {
    turndownService = new TurndownService({
      headingStyle: "atx", // Use # for headings
      codeBlockStyle: "fenced", // Use ``` for code blocks
      bulletListMarker: "-", // Use - for bullet lists
      emDelimiter: "*", // Use * for emphasis
      strongDelimiter: "**", // Use ** for strong
      linkStyle: "inlined", // Use inline links [text](url)
      linkReferenceStyle: "full", // Use full reference links
    });
  } catch (error) {
    console.error("[HTML to Markdown] Failed to initialize Turndown:", error);
    // Fallback: strip HTML tags and return plain text
    return cleanedHtml.replace(/<[^>]*>/g, "").trim();
  }

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

  // Convert HTML to Markdown with error handling
  let markdown: string;
  try {
    markdown = turndownService.turndown(cleanedHtml);
  } catch (error) {
    console.error("[HTML to Markdown] Turndown conversion failed:", error);
    // Fallback: strip HTML tags and return plain text
    return cleanedHtml.replace(/<[^>]*>/g, "").trim();
  }

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
