import {
  AlertCircle,
  CheckCircle2,
  Info,
  ShieldAlert,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobData } from "@/lib/linkedin-dom/types";
import type { LocalRuleFlag, LocalRulesResult } from "@/lib/local-rules/types";
import { cn } from "@/lib/utils";

export interface RiskReportData {
  jobData: JobData;
  localResult: LocalRulesResult;
  geminiResult?: {
    riskScore: number;
    riskLevel: "safe" | "caution" | "danger";
    flags: Array<{
      type: string;
      confidence: "low" | "medium" | "high";
      message: string;
      reasoning?: string;
    }>;
    summary?: string;
  };
}

interface RiskReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RiskReportData;
  onReportIssue?: () => void;
}

const confidenceLabels = {
  high: "High Confidence",
  medium: "Medium Confidence",
  low: "Low Confidence",
};

const confidenceColors = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-gray-600 dark:text-gray-400",
};

const riskLevelConfig = {
  safe: {
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    label: "Safe",
    description: "This job posting appears legitimate",
  },
  caution: {
    icon: ShieldAlert,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    label: "Caution",
    description: "Some concerns detected - proceed carefully",
  },
  danger: {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    label: "Danger",
    description: "Multiple scam indicators detected - do NOT apply",
  },
};

export function RiskReport({
  open,
  onOpenChange,
  data,
  onReportIssue,
}: RiskReportProps) {
  const { jobData, localResult, geminiResult } = data;

  // Use Gemini result if available, otherwise use local result
  const finalResult = geminiResult || {
    riskScore: localResult.riskScore,
    riskLevel: localResult.riskLevel,
    flags: localResult.flags.map((flag) => ({
      type: flag.type,
      confidence: flag.confidence,
      message: flag.message,
      reasoning: flag.message, // Use message as reasoning for local flags
    })),
    summary: `Risk analysis based on ${localResult.flags.length} detected flag${localResult.flags.length !== 1 ? "s" : ""}`,
  };

  const config = riskLevelConfig[finalResult.riskLevel];
  const Icon = config.icon;

  // Sort flags by confidence (high first)
  const sortedFlags = [...finalResult.flags].sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 };
    return order[b.confidence] - order[a.confidence];
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full",
                config.bgColor
              )}
            >
              <Icon className={cn("size-6", config.color)} />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl">
                {config.label} - Risk Score: {finalResult.riskScore}/100
              </DialogTitle>
              <DialogDescription className="mt-1 text-base">
                {config.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Job Information */}
          <div className="bg-muted/50 rounded-lg border p-4">
            <h3 className="mb-2 text-sm font-semibold">Job Information</h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Title:</span> {jobData.title}
              </p>
              {jobData.company && (
                <p>
                  <span className="font-medium">Company:</span>{" "}
                  {jobData.company}
                </p>
              )}
              {jobData.location && (
                <p>
                  <span className="font-medium">Location:</span>{" "}
                  {jobData.location}
                </p>
              )}
              {jobData.salary && (
                <p>
                  <span className="font-medium">Salary:</span> {jobData.salary}
                </p>
              )}
            </div>
          </div>

          {/* Red Flags Section */}
          {sortedFlags.length > 0 ? (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <AlertCircle className="size-5 text-red-600 dark:text-red-400" />
                Red Flags Detected ({sortedFlags.length})
              </h3>
              <div className="space-y-3">
                {sortedFlags.map((flag, index) => (
                  <div
                    key={`${flag.type}-${index}`}
                    className="hover:bg-muted/50 rounded-lg border p-4 transition-colors"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h4 className="flex-1 text-sm font-medium">
                        {index + 1}.{" "}
                        {flag.type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </h4>
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium",
                          confidenceColors[flag.confidence],
                          "bg-muted"
                        )}
                      >
                        {confidenceLabels[flag.confidence]}
                      </span>
                    </div>
                    <p className="text-muted-foreground mb-2 text-sm">
                      {flag.message}
                    </p>
                    {flag.reasoning && flag.reasoning !== flag.message && (
                      <div className="mt-2 border-t pt-2">
                        <p className="text-muted-foreground flex items-start gap-2 text-xs">
                          <Info className="mt-0.5 size-3 shrink-0" />
                          <span>{flag.reasoning}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-950/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium">
                  No red flags detected. This job posting appears legitimate.
                </p>
              </div>
            </div>
          )}

          {/* Recommendation */}
          {finalResult.summary && (
            <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/20">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Info className="size-4 text-blue-600 dark:text-blue-400" />
                Recommendation
              </h3>
              <p className="text-muted-foreground text-sm">
                {finalResult.summary}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {onReportIssue && (
            <Button
              variant="outline"
              onClick={onReportIssue}
              className="w-full sm:w-auto"
            >
              Report Issue with this Scan
            </Button>
          )}
          <Button
            variant="default"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
