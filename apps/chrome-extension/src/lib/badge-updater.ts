import * as React from "react";
import { createRoot } from "react-dom/client";

import { RiskBadge } from "@/components/risk-badge";
import type { RiskLevel } from "@/components/risk-badge";

/**
 * Update badge in a container with new risk data
 */
export function updateBadge(
  container: HTMLElement,
  riskLevel: RiskLevel,
  riskScore?: number
) {
  // Update data attributes
  container.setAttribute("data-risk-level", riskLevel);
  if (riskScore !== undefined) {
    container.setAttribute("data-risk-score", String(riskScore));
  }

  // Unmount existing badge if present
  const existingRoot = (container as any).__badgeRoot;
  if (existingRoot) {
    existingRoot.unmount();
  }

  // Create new root and mount updated badge
  const root = createRoot(container);
  (container as any).__badgeRoot = root;

  const handleClick = () => {
    const jobId = container.getAttribute("data-job-id") || "";
    const event = new CustomEvent("scam-detector:open-report", {
      detail: {
        jobId,
        container,
      },
      bubbles: true,
    });
    container.dispatchEvent(event);
  };

  root.render(
    React.createElement(RiskBadge, {
      riskLevel,
      riskScore,
      onClick: handleClick,
    })
  );
}
