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
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-full shadow-md",
                config.bgColor
              )}
            >
              <Icon className={cn("size-7", config.color)} />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <DialogTitle className="text-2xl font-bold">
                  {config.label} - {finalResult.riskScore}/100
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-base">
                  {config.description}
                </DialogDescription>
              </div>
              {/* Risk Score Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Risk Score</span>
                  <span className="font-medium">{finalResult.riskScore}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      finalResult.riskLevel === "safe" && "bg-green-500",
                      finalResult.riskLevel === "caution" && "bg-yellow-500",
                      finalResult.riskLevel === "danger" && "bg-red-500"
                    )}
                    style={{ width: `${finalResult.riskScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Job Information */}
          <div className="bg-muted/50 rounded-lg border p-6 space-y-2">
            <h3 className="mb-3 text-sm font-semibold text-foreground/80 uppercase tracking-wide">
              Job Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="font-medium text-muted-foreground min-w-[80px]">Title:</span>
                <span className="flex-1">{jobData.title}</span>
              </div>
              {jobData.company && (
                <div className="flex items-start gap-2">
                  <span className="font-medium text-muted-foreground min-w-[80px]">Company:</span>
                  <span className="flex-1">{jobData.company}</span>
                </div>
              )}
              {jobData.location && (
                <div className="flex items-start gap-2">
                  <span className="font-medium text-muted-foreground min-w-[80px]">Location:</span>
                  <span className="flex-1">{jobData.location}</span>
                </div>
              )}
              {jobData.salary && (
                <div className="flex items-start gap-2">
                  <span className="font-medium text-muted-foreground min-w-[80px]">Salary:</span>
                  <span className="flex-1">{jobData.salary}</span>
                </div>
              )}
            </div>
          </div>

          {/* Red Flags Section */}
          {sortedFlags.length > 0 ? (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <AlertCircle className="size-5 text-red-600 dark:text-red-400" />
                Red Flags Detected ({sortedFlags.length})
              </h3>
              <div className="space-y-3">
                {sortedFlags.map((flag, index) => (
                  <div
                    key={`${flag.type}-${index}`}
                    className="hover:bg-muted/70 rounded-lg border p-5 transition-all duration-200 hover:shadow-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h4 className="flex-1 text-sm font-semibold">
                        {index + 1}.{" "}
                        {flag.type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </h4>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm",
                          flag.confidence === "high" &&
                            "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
                          flag.confidence === "medium" &&
                            "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400",
                          flag.confidence === "low" &&
                            "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        )}
                      >
                        {confidenceLabels[flag.confidence]}
                      </span>
                    </div>
                    <p className="text-muted-foreground mb-2 text-sm leading-relaxed">
                      {flag.message}
                    </p>
                    {flag.reasoning && flag.reasoning !== flag.message && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
                          <Info className="mt-0.5 size-3.5 shrink-0" />
                          <span>{flag.reasoning}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-green-50 p-5 dark:bg-green-950/20 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium">
                  No red flags detected. This job posting appears legitimate.
                </p>
              </div>
            </div>
          )}

          {/* Recommendation */}
          {finalResult.summary && (
            <div className="rounded-lg border bg-sky-50 p-5 dark:bg-sky-950/20 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Info className="size-5 text-sky-600 dark:text-sky-400" />
                Recommendation
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {finalResult.summary}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row pt-2 border-t">
          {onReportIssue && (
            <Button
              variant="outline"
              onClick={onReportIssue}
              className="w-full sm:w-auto shadow-sm hover:shadow"
            >
              Report Issue with this Scan
            </Button>
          )}
          <Button
            variant="default"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto shadow-sm hover:shadow"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
