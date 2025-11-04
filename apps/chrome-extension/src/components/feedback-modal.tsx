import { sendToBackground } from "@plasmohq/messaging";
import { useState } from "react";

import type {
  SubmitFeedbackRequestBody,
  SubmitFeedbackResponseBody,
} from "@/background/messages/submit-feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

export type FeedbackType = "false_positive" | "false_negative" | "other";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobUrl: string;
  onSubmit?: () => void;
}

export function FeedbackModal({
  open,
  onOpenChange,
  jobUrl,
  onSubmit,
}: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType | "">("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!feedbackType) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Send feedback to background worker
      const requestBody: SubmitFeedbackRequestBody = {
        jobUrl,
        feedbackType,
        details: feedbackType === "other" ? details : details || undefined,
      };

      const response = await sendToBackground<
        SubmitFeedbackRequestBody,
        SubmitFeedbackResponseBody
      >({
        name: "submit-feedback",
        body: requestBody,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to submit feedback");
      }

      setIsSubmitted(true);
      onSubmit?.();

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onOpenChange(false);
        // Reset form
        setTimeout(() => {
          setFeedbackType("");
          setDetails("");
          setIsSubmitted(false);
        }, 300);
      }, 1500);
    } catch (error) {
      console.error("[FeedbackModal] Failed to submit feedback:", error);
      // Show error message (could be enhanced with toast notification)
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      // Reset form after close animation
      setTimeout(() => {
        setFeedbackType("");
        setDetails("");
        setIsSubmitted(false);
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report Issue with this Scan</DialogTitle>
          <DialogDescription>
            Help us improve by reporting any issues with this scan. Your
            feedback is anonymous and helps protect other job seekers.
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Thank you for your feedback!
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Your report helps us improve scam detection.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <RadioGroup
              value={feedbackType}
              onValueChange={(value) => setFeedbackType(value as FeedbackType)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false_positive" id="false_positive" />
                <Label
                  htmlFor="false_positive"
                  className="cursor-pointer font-normal"
                >
                  False positive (this job is legitimate but marked as scam)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false_negative" id="false_negative" />
                <Label
                  htmlFor="false_negative"
                  className="cursor-pointer font-normal"
                >
                  False negative (this job is suspicious but marked safe)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other" className="cursor-pointer font-normal">
                  Other issue
                </Label>
              </div>
            </RadioGroup>

            {feedbackType === "other" && (
              <div className="space-y-2">
                <Label htmlFor="details">Please describe the issue</Label>
                <Textarea
                  id="details"
                  placeholder="Describe what went wrong with this scan..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {feedbackType && feedbackType !== "other" && (
              <div className="space-y-2">
                <Label htmlFor="optional-details">
                  Additional details (optional)
                </Label>
                <Textarea
                  id="optional-details"
                  placeholder="Any additional information that might help..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!isSubmitted && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleSubmit}
                disabled={!feedbackType || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
