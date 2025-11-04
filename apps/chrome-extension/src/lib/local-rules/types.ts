export interface JobData {
  description: string;
  title: string;
  company: string;
  salary?: string;
}

export interface LocalRuleFlag {
  type: string;
  confidence: "low" | "medium" | "high";
  message: string;
}

export interface LocalRulesResult {
  riskScore: number; // 0-100
  riskLevel: "safe" | "caution" | "danger";
  flags: LocalRuleFlag[];
}
