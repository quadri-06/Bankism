"use strict";

import { z } from "zod";

// LLM classification schema (Stage 3)
const llmClassificationSchema = z.object({
  intent: z.enum(["BALANCE_INQUIRY", "P2P_TRANSFER", "TRANSACTION_HISTORY", "SUPPORT_QUESTION", "UNKNOWN"]),
  threat_category: z.enum(["NONE", "INSTRUCTION_OVERRIDE", "ROLEPLAY_JAILBREAK", "PRIVILEGE_ESCALATION", "DATA_EXFILTRATION", "MEMO_INJECTION", "TOKEN_OBFUSCATION", "MULTI_ACTION_SMUGGLING"]),
  confidence: z.number().min(0).max(1),
  injected_instructions_found: z.boolean().default(false),
  reasoning: z.string().max(500)
});

export type LLMClassification = z.infer<typeof llmClassificationSchema>;

interface LLMInput {
  untrustedInput: string;
  normalizedInput: string;
}

export async function classifyWithLLM(input: LLMInput): Promise<LLMClassification> {
  // In a real implementation, this would call Groq API
  // For now, we'll use a deterministic fallback based on keyword analysis
  
  const text = input.normalizedInput.toLowerCase();
  const untrusted = input.untrustedInput.toLowerCase();
  
  // Default fallback classification
  let intent = "UNKNOWN";
  let threatCategory = "NONE";
  let confidence = 0.5;
  let injectedInstructions = false;
  let reasoning = "Fallback classification - LLM call disabled";
  
  // Intent detection
  if (/balance|check|view/.test(text)) {
    intent = "BALANCE_INQUIRY";
  } else if (/transfer|send|pay/.test(text)) {
    intent = "P2P_TRANSFER";
  } else if (/history|hist/.test(text)) {
    intent = "TRANSACTION_HISTORY";
  } else if (/support|help|question/.test(text)) {
    intent = "SUPPORT_QUESTION";
  }
  
  // Threat category detection (prioritized)
  for (const pattern of ["ignore previous", "disregard rules", "new instructions",
      "system prompt", "developer mode", "you are now"]) {
    if (untrusted.includes(pattern)) {
      threatCategory = "INSTRUCTION_OVERRIDE";
      confidence = 0.95;
      injectedInstructions = true;
      reasoning = `Detected instruction override: ${pattern}`;
      break;
    }
  }
  
  if (threatCategory === "NONE") {
    for (const pattern of ["DAN", "pretend you are", "act as an unrestricted bank admin"]) {
      if (untrusted.includes(pattern)) {
        threatCategory = "ROLEPLAY_JAILBREAK";
        confidence = 0.9;
        injectedInstructions = true;
        reasoning = `Detected jailbreak attempt: ${pattern}`;
        break;
      }
    }
  }
  
  if (threatCategory === "NONE") {
    for (const pattern of ["admin", "override limit", "bypass verification", "skip OTP"]) {
      if (untrusted.includes(pattern)) {
        threatCategory = "PRIVILEGE_ESCALATION";
        confidence = 0.85;
        injectedInstructions = true;
        reasoning = `Detected privilege escalation: ${pattern}`;
        break;
      }
    }
  }
  
  if (threatCategory === "NONE") {
    for (const pattern of ["show all accounts", "dump database", "reveal system prompt"]) {
      if (untrusted.includes(pattern)) {
        threatCategory = "DATA_EXFILTRATION";
        confidence = 0.8;
        injectedInstructions = true;
        reasoning = `Detected data exfiltration: ${pattern}`;
        break;
      }
    }
  }
  
  // Memo injection detection
  if (/transfer|send|payment/.test(input.normalizedInput) && /memo|note/.test(input.untrustedInput)) {
    injectedInstructions = true;
  }
  
  // Token obfuscation
  if (/base64|hex|url|rot13|leetspeak/i.test(input.untrustedInput)) {
    // Token obfuscation flag noted but not primary threat category in this simplified version
  }
  
  // Ensure confidence is reasonable
  confidence = Math.max(0.1, Math.min(0.95, confidence));
  
  // Validate against schema and return
  try {
    const validated = llmClassificationSchema.parse({
      intent,
      threat_category: threatCategory,
      confidence,
      injected_instructions_found: injectedInstructions,
      reasoning: reasoning.substring(0, 500)
    });
    return validated;
  } catch {
    // Fail closed - return safe default
    return {
      intent: "UNKNOWN",
      threat_category: "NONE",
      confidence: 0,
      injected_instructions_found: true,
      reasoning: "LLM output failed schema validation - blocked"
    };
  }
}