"use strict";

import { z } from "zod";

// Stage 5: Risk fusion and verdict
const verdictSchema = z.object({
  request_id: z.string().uuid(),
  verdict: z.enum(["approved", "blocked"]),
  risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  risk_score: z.number().min(0).max(100),
  threat_category: z.enum([
    "NONE", "INSTRUCTION_OVERRIDE", "ROLEPLAY_JAILBREAK",
    "PRIVILEGE_ESCALATION", "DATA_EXFILTRATION", "MEMO_INJECTION",
    "TOKEN_OBFUSCATION", "MULTI_ACTION_SMUGGLING", "POLICY_VIOLATION", "AMBIGUOUS_INPUT"
  ]),
  intent: z.enum(["BALANCE_INQUIRY", "P2P_TRANSFER", "TRANSACTION_HISTORY", "SUPPORT_QUESTION", "UNKNOWN"]),
  rationale: z.string().max(500),
  stages: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    score: z.number(),
    details: z.string()
  })),
  action: z.enum(["EXECUTE", "REJECT", "REQUIRE_STEP_UP"]),
  extracted_params: z.object({
    intent: z.string(),
    recipient: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    memo: z.string().optional()
  }),
  timestamp: z.string().datetime()
});

export type Verdict = z.infer<typeof verdictSchema>;

interface StageResult {
  name: string;
  passed: boolean;
  score: number;
  details: string;
}

// Validation flags type for risk fusion
interface ValidationFlags {
  hasAmbiguity: boolean;
  requiresStepUp: boolean;
  hasInjection: boolean;
  details?: string;
}

export function calculateRiskLevel(ruleScore: number, llmConfidence: number, validationFlags: ValidationFlags): { riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; riskScore: number; stages: StageResult[] } {
  // Weighted score calculation
  const weightedRule = ruleScore * 0.4;
  const weightedLlm = Math.round(llmConfidence * 100) * 0.3;
  const weightedValidation = (validationFlags.hasAmbiguity || validationFlags.requiresStepUp || validationFlags.hasInjection) ? 25 : 0;

  const finalScore = Math.min(Math.round(weightedRule + weightedLlm + weightedValidation), 100);

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  let action: "EXECUTE" | "REJECT" | "REQUIRE_STEP_UP" = "REJECT";

  // Stages
  const stages: StageResult[] = [
    { name: "Auth Gate", passed: true, score: 0, details: "Session verified" },
    { name: "Input Normalization", passed: true, score: 0, details: "NFKC normalization applied" },
    { name: "Rule-Based Detection", passed: ruleScore < 50, score: ruleScore, details: `Rule score: ${ruleScore}` },
    { name: "LLM Classifier", passed: true, score: Math.round(llmConfidence * 100), details: "LLM classification completed" },
    { name: "Deterministic Validation", passed: !validationFlags.hasAmbiguity && !validationFlags.requiresStepUp, score: validationFlags.hasAmbiguity || validationFlags.requiresStepUp ? 50 : 0, details: validationFlags.details || "Passed" }
  ];

  // Determine risk level and action
  if (finalScore > 75) {
    riskLevel = "CRITICAL";
    action = "REJECT";
  } else if (finalScore >= 50) {
    riskLevel = "HIGH";
    action = "REQUIRE_STEP_UP";
  } else if (finalScore >= 25) {
    riskLevel = "MEDIUM";
    action = "REJECT";
  } else {
    riskLevel = "LOW";
    if (!validationFlags.hasAmbiguity && !validationFlags.requiresStepUp && !validationFlags.hasInjection) {
      action = "EXECUTE";
    } else {
      action = "REJECT";
    }
  }

  return {
    riskLevel,
    riskScore: finalScore,
    stages
  };
}

export function generateVerdict({
  requestId,
  ruleScore,
  llmClassification,
  validatedParams,
  validationFlags,
  stages
}: {
  requestId: string;
  ruleScore: number;
  llmClassification: any;
  validatedParams?: any;
  validationFlags: ValidationFlags;
  stages: StageResult[];
}): Verdict {
  const { riskLevel, riskScore } = calculateRiskLevel(ruleScore, llmClassification.confidence, validationFlags);

  // Determine verdict and action
  let verdict: "approved" | "blocked";
  let action: "EXECUTE" | "REJECT" | "REQUIRE_STEP_UP";
  let threatCategory: string = "NONE";

  // Priority 1: Instruction override
  if (llmClassification.threat_category === "INSTRUCTION_OVERRIDE" || validationFlags.hasInjection) {
    verdict = "blocked";
    action = "REJECT";
    threatCategory = llmClassification.threat_category;
  }
  // Priority 2: High risk categories
  else if (["ROLEPLAY_JAILBREAK", "PRIVILEGE_ESCALATION", "DATA_EXFILTRATION"].includes(llmClassification.threat_category)) {
    verdict = "blocked";
    action = "REJECT";
    threatCategory = llmClassification.threat_category;
  }
  // Priority 3: Token obfuscation
  else if (llmClassification.threat_category === "TOKEN_OBFUSCATION") {
    verdict = "blocked";
    action = "REJECT";
    threatCategory = "TOKEN_OBFUSCATION";
  }
  // Priority 4: Medium risk with valid intent
  else if (riskLevel === "MEDIUM" && validatedParams && validatedParams.intent) {
    verdict = "blocked";
    action = "REQUIRE_STEP_UP";
    threatCategory = "POLICY_VIOLATION";
  }
  // Priority 5: Low risk - approve if all checks pass
  else if (riskLevel === "LOW" && !validationFlags.hasAmbiguity && !validationFlags.requiresStepUp && !validationFlags.hasInjection && validatedParams) {
    verdict = "approved";
    action = "EXECUTE";
    threatCategory = "NONE";
  }
  // Priority 6: Ambiguous input
  else if (validationFlags.hasAmbiguity) {
    verdict = "blocked";
    action = "REJECT";
    threatCategory = "AMBIGUOUS_INPUT";
  }
  // Default block
  else {
    verdict = "blocked";
    action = "REJECT";
    threatCategory = "POLICY_VIOLATION";
  }

  // Build extracted_params - always an object, never null
  let extractedParams: { intent: string; recipient?: string; amount?: number; currency?: string; memo?: string } = {
    intent: "UNKNOWN"
  };
  if (validatedParams && (validatedParams.intent === "balance_inquiry" || validatedParams.intent === "p2p_transfer" || validatedParams.intent === "transaction_history")) {
    extractedParams = {
      intent: validatedParams.intent,
      ...(validatedParams.recipient && { recipient: validatedParams.recipient }),
      ...(validatedParams.amount && { amount: validatedParams.amount }),
      ...(validatedParams.currency && { currency: validatedParams.currency }),
      ...(validatedParams.memo && { memo: validatedParams.memo })
    };
  }

  // Rationale - concise, no system prompt leakage
  let rationale: string;
  if (verdict === "approved") {
    rationale = `Input validated: ${riskLevel.toLowerCase()} risk, intent=${validatedParams?.intent}, all checks passed`;
  } else if (action === "REQUIRE_STEP_UP") {
    rationale = `Risk ${riskLevel.toLowerCase()}: requires step-up verification for ${validatedParams?.intent || 'transfer'}`;
  } else {
    rationale = `Blocked: ${threatCategory || 'policy violation'}`;
    if (threatCategory === "INSTRUCTION_OVERRIDE") {
      rationale = "Blocked: instruction override detected";
    }
  }

  return {
    request_id: requestId,
    verdict,
    risk_level: riskLevel,
    risk_score: riskScore,
    threat_category: threatCategory as any,
    intent: validatedParams?.intent || llmClassification.intent || "UNKNOWN",
    rationale: rationale.substring(0, 500),
    stages,
    action,
    extracted_params: extractedParams,
    timestamp: new Date().toISOString()
  };
}