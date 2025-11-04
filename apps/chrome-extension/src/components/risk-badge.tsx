import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type RiskLevel = "safe" | "caution" | "danger" | "loading";

interface RiskBadgeProps {
  riskLevel: RiskLevel;
  riskScore?: number;
  onClick?: () => void;
  className?: string;
}

const riskConfig = {
  safe: {
    color: "bg-green-500",
    textColor: "text-white",
    borderColor: "border-green-600",
    icon: CheckCircle2,
    label: "Safe",
    hover: "hover:bg-green-600",
  },
  caution: {
    color: "bg-yellow-500",
    textColor: "text-white",
    borderColor: "border-yellow-600",
    icon: ShieldAlert,
    label: "Caution",
    hover: "hover:bg-yellow-600",
  },
  danger: {
    color: "bg-red-500",
    textColor: "text-white",
    borderColor: "border-red-600",
    icon: AlertCircle,
    label: "Danger",
    hover: "hover:bg-red-600",
  },
  loading: {
    color: "bg-gray-500",
    textColor: "text-white",
    borderColor: "border-gray-600",
    icon: Loader2,
    label: "Scanning...",
    hover: "",
  },
};

export function RiskBadge({
  riskLevel,
  riskScore,
  onClick,
  className,
}: RiskBadgeProps) {
  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  const isClickable = onClick && riskLevel !== "loading";
  const isAnimating = riskLevel === "loading";

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={cn(
        // Match LinkedIn button sizing: height ~40px, padding px-4 py-2
        "inline-flex items-center justify-center gap-2",
        "h-10 px-4 py-2",
        "rounded-full border font-medium shadow-sm",
        "text-sm leading-5",
        "transition-all duration-200",
        config.color,
        config.textColor,
        config.borderColor,
        isClickable && "cursor-pointer",
        isClickable && config.hover,
        isClickable && "hover:shadow-md active:shadow-sm",
        !isClickable && "cursor-default",
        isAnimating && "animate-pulse",
        className
      )}
      aria-label={`Risk level: ${config.label}${riskScore ? ` (${riskScore}/100)` : ""}`}
      title={`Risk level: ${config.label}${riskScore ? ` - Score: ${riskScore}/100` : ""}. Click for details.`}
    >
      <Icon className={cn("size-4 shrink-0", isAnimating && "animate-spin")} />
      <span className="font-semibold whitespace-nowrap">{config.label}</span>
      {riskScore !== undefined && riskLevel !== "loading" && (
        <span className="text-sm font-medium opacity-90">({riskScore})</span>
      )}
    </button>
  );
}
