import type { PlasmoMessaging } from "@plasmohq/messaging";

import { analyzeJobPosting } from "@/lib/local-rules";
import type { JobData } from "@/lib/local-rules/types";
import {
  incrementScannedToday,
  incrementThreatsBlocked,
} from "@/lib/utils/stats";
import { getSession } from "@/shared/sessionManager";
import { callerApi } from "@/trpc/caller";

export interface ScanJobRequestBody {
  jobData: JobData;
  jobUrl: string;
  jobId: string;
}

export interface ScanJobResponseBody {
  jobId: string;
  preliminary?: {
    riskScore: number;
    riskLevel: "safe" | "caution" | "danger";
    flags: Array<{
      type: string;
      confidence: "low" | "medium" | "high";
      message: string;
    }>;
  };
  final?: {
    riskScore: number;
    riskLevel: "safe" | "caution" | "danger";
    flags: Array<{
      type: string;
      confidence: "low" | "medium" | "high";
      message: string;
      reasoning?: string;
    }>;
    summary?: string;
    source: "gemini" | "cache" | "fallback";
  };
  error?: string;
}

/**
 * Background message handler for job scanning
 *
 * Flow:
 * 1. Run local rules engine immediately (instant result)
 * 2. Send preliminary result back to content script
 * 3. Call tRPC scanJob endpoint for full AI analysis
 * 4. Send final result back to content script
 */
const handler: PlasmoMessaging.MessageHandler<
  ScanJobRequestBody,
  ScanJobResponseBody
> = async (req, res) => {
  const { jobData, jobUrl, jobId } = req.body ?? {};

  if (!jobData || !jobUrl || !jobId) {
    res.send({
      jobId: jobId || "unknown",
      error: "Missing required fields in request body",
    });
    return;
  }

  try {
    // Step 1: Run local rules engine for instant preliminary result
    const preliminaryResult = analyzeJobPosting({
      description: jobData.description || "",
      title: jobData.title,
      company: jobData.company || "",
      salary: jobData.salary,
    });

    // Step 2: Send preliminary result immediately
    res.send({
      jobId,
      preliminary: {
        riskScore: preliminaryResult.riskScore,
        riskLevel: preliminaryResult.riskLevel,
        flags: preliminaryResult.flags.map((flag) => ({
          type: flag.type,
          confidence: flag.confidence,
          message: flag.message,
        })),
      },
    });

    // Track stats: increment scanned count
    incrementScannedToday().catch((err) => {
      console.error("[scan-job] Failed to track scan:", err);
    });

    // Step 2.5: Save job data to database first
    // Get session to pass to saveJob (if authenticated)
    const session = await getSession().catch(() => null);
    
    // Save job to database
    callerApi.scamDetector.saveJob
      .mutate({
        linkedinJobId: jobData.linkedinJobId,
        url: jobUrl,
        title: jobData.title,
        company: jobData.company || "",
        description: jobData.description || "",
        location: jobData.location,
        salary: jobData.salary,
        employmentType: jobData.employmentType,
        postedDate: jobData.postedDate,
        rawData: {
          // Store any additional fields in rawData
          linkedinJobId: jobData.linkedinJobId,
        },
      })
      .then(async (saveResult) => {
        // After saving job, extract structured data using AI
        if (saveResult.jobId) {
          callerApi.scamDetector.extractJobData
            .mutate({
              jobId: saveResult.jobId,
              jobText: jobData.description || "",
              jobTitle: jobData.title,
              companyName: jobData.company,
            })
            .catch((extractError) => {
              // Log but don't fail if extraction fails
              console.error("[scan-job] Job extraction failed:", extractError);
            });
        }
      })
      .catch((saveError) => {
        // Log but don't fail if save fails
        console.error("[scan-job] Failed to save job:", saveError);
      });

    // Step 3: Run full AI analysis asynchronously (don't await in handler)
    // Send final result via chrome.tabs.sendMessage to the content script
    callerApi.scamDetector.scanJob
      .mutate({
        jobText: jobData.description || "",
        jobUrl,
        companyName: jobData.company,
      })
      .then((geminiResult) => {
        // Get the sender tab ID from the request
        const senderTabId = req.sender?.tab?.id;

        // Determine final risk level
        const finalRiskLevel =
          geminiResult.riskLevel ||
          (geminiResult.riskScore < 40
            ? "safe"
            : geminiResult.riskScore < 70
              ? "caution"
              : "danger");

        // Track threat if risk level is danger
        if (finalRiskLevel === "danger") {
          incrementThreatsBlocked().catch((err) => {
            console.error("[scan-job] Failed to track threat:", err);
          });
        }

        if (senderTabId) {
          // Send message directly to content script (works in ISOLATED world)
          chrome.tabs
            .sendMessage(senderTabId, {
              type: "scam-detector:final-result",
              jobId,
              final: {
                riskScore: geminiResult.riskScore,
                riskLevel: finalRiskLevel,
                flags: geminiResult.flags,
                summary: geminiResult.summary,
                source: geminiResult.source || "gemini",
              },
            })
            .catch((err) => {
              console.error("[scan-job] Failed to send final result:", err);
            });
        } else {
          console.error("[scan-job] No sender tab ID available");
        }
      })
      .catch((aiError) => {
        console.error("[scan-job] AI analysis failed:", aiError);
        // Send error result via message
        const senderTabId = req.sender?.tab?.id;
        if (senderTabId) {
          // Send error result directly to content script (works in ISOLATED world)
          chrome.tabs
            .sendMessage(senderTabId, {
              type: "scam-detector:final-result",
              jobId,
              final: {
                riskScore: preliminaryResult.riskScore,
                riskLevel: preliminaryResult.riskLevel,
                flags: preliminaryResult.flags.map((flag) => ({
                  type: flag.type,
                  confidence: flag.confidence,
                  message: flag.message,
                })),
                summary:
                  "AI analysis unavailable. Showing local analysis only.",
                source: "fallback",
              },
              error:
                aiError instanceof Error ? aiError.message : "Unknown error",
            })
            .catch((err) => {
              console.error("[scan-job] Failed to send error result:", err);
            });
        }
      });
  } catch (error) {
    console.error("[scan-job] Error:", error);
    res.send({
      jobId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export default handler;
