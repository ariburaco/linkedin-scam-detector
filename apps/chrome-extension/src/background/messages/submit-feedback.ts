import type { PlasmoMessaging } from "@plasmohq/messaging";

import { hashString } from "@/lib/utils/hash";
import { callerApi } from "@/trpc/caller";

export interface SubmitFeedbackRequestBody {
  jobUrl: string;
  feedbackType: "false_positive" | "false_negative" | "other";
  details?: string;
}

export interface SubmitFeedbackResponseBody {
  success: boolean;
  error?: string;
}

/**
 * Background message handler for submitting feedback
 *
 * Flow:
 * 1. Hash the job URL using SHA-256 for privacy
 * 2. Call tRPC submitFeedback mutation
 * 3. Return success/error response
 */
const handler: PlasmoMessaging.MessageHandler<
  SubmitFeedbackRequestBody,
  SubmitFeedbackResponseBody
> = async (req, res) => {
  const { jobUrl, feedbackType, details } = req.body ?? {};

  if (!jobUrl || !feedbackType) {
    res.send({
      success: false,
      error: "Missing required fields: jobUrl and feedbackType",
    });
    return;
  }

  try {
    // Hash the job URL using SHA-256 for privacy
    const jobUrlHash = await hashString(jobUrl);

    // Call tRPC submitFeedback mutation
    await callerApi.scamDetector.submitFeedback.mutate({
      jobUrlHash,
      feedbackType,
      details,
    });

    res.send({
      success: true,
    });
  } catch (error) {
    console.error("[submit-feedback] Error:", error);
    res.send({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export default handler;
