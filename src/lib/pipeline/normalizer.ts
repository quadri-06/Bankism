"use strict";

import { z } from "zod";

// Stage 1: Input Normalization
const normalizationSchema = z.object({
  original: z.string(),
  normalized: z.string(),
  obfuscation_flags: z.array(z.enum(["BASE64", "HEX", "URL_ENCODED", "ROT13", "LEETSPEAK", "SPACED_OUT", "HOMOGLYPH"]))
});

export type NormalizationResult = z.infer<typeof normalizationSchema>;

export function normalizeInput(rawInput: string): NormalizationResult {
  const flags: ("BASE64" | "HEX" | "URL_ENCODED" | "ROT13" | "LEETSPEAK" | "SPACED_OUT" | "HOMOGLYPH")[] = [];
  let normalized = rawInput;

  // Unicode NFKC normalization
  normalized = normalized.normalize("NFKC");

  // Strip zero-width characters
  normalized = normalized.replace(/\p{Z}/gu, "");

  // Strip bidi control characters
  normalized = normalized.replace(/[\u200E\u200F\u202A-\u202E]/g, "");

  // Detect and flag base64 (long strings with base64 charset)
  const base64Pattern = /^[A-Za-z0-9+/=]{50,}$/;
  if (base64Pattern.test(normalized)) {
    flags.push("BASE64");
  }

  // Detect hex
  const hexPattern = /^[0-9A-Fa-f]{30,}$/;
  if (hexPattern.test(normalized)) {
    flags.push("HEX");
  }

  // Detect URL encoding
  if (normalized.includes("%")) {
    flags.push("URL_ENCODED");
  }

  // Detect ROT13
  if (/[a-zA-Z]/.test(normalized)) {
    const rot13Test = normalized.split("").some(c =>
      (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
    );
    if (rot13Test) {
      flags.push("ROT13");
    }
  }

  // Detect leetspeak
  const leetPattern = /[aA][4@]|[eE][3#]|[gG][96]|[iI][1!]|[oO][0@]|[sS][5$]|[tT][7]|[yY][^]']/;
  if (leetPattern.test(normalized)) {
    flags.push("LEETSPEAK");
  }

  // Detect spaced-out letters ("i g n o r e")
  if (/\s/.test(normalized) && /ignore/i.test(normalized.replace(/\s/g, ""))) {
    flags.push("SPACED_OUT");
    normalized = normalized.replace(/\s/g, "");
  }

  // Homoglyph detection (Cyrillic/Greek lookalikes)
  const homoglyphMap: Record<string, string> = {
    // Cyrillic
    "\u0430": "a", "\u0435": "e", "\u0436": "g", "\u0443": "o", "\u044f": "t",
    // Greek
    "\u03b1": "a", "\u03b5": "e", "\u03b3": "g", "\u03bf": "o", "\u03c4": "t"
  };
  for (const [glyph, latin] of Object.entries(homoglyphMap)) {
    if (normalized.includes(glyph)) {
      flags.push("HOMOGLYPH");
      normalized = normalized.replace(new RegExp(glyph, "g"), latin);
    }
  }

  // Collapse spaced-out letters (already handled above, but ensure)
  // Re-check after homoglyph replacement
  if (/\s/.test(normalized) && /ignore/i.test(normalized.replace(/\s/g, ""))) {
    flags.push("SPACED_OUT");
    normalized = normalized.replace(/\s/g, "");
  }

  const normalizedFlags = [...new Set(flags)]
    .filter((f): f is "BASE64" | "HEX" | "URL_ENCODED" | "ROT13" | "LEETSPEAK" | "SPACED_OUT" | "HOMOGLYPH" => 
      ["BASE64", "HEX", "URL_ENCODED", "ROT13", "LEETSPEAK", "SPACED_OUT", "HOMOGLYPH"].includes(f)
    );

  return {
    original: rawInput,
    normalized: normalized.length > 500 ? normalized.substring(0, 500) : normalized,
    obfuscation_flags: normalizedFlags
  };
}

// Rule-based detection (Stage 2)
const ruleWeights: Record<string, number> = {
  INSTRUCTION_OVERRIDE: 15,
  ROLEPLAY_JAILBREAK: 20,
  PRIVILEGE_ESCALATION: 15,
  DATA_EXFILTRATION: 25,
  MEMO_INJECTION: 20,
  TOKEN_OBFUSCATION: 10,
  MULTI_ACTION_SMUGGLING: 30
};

export interface RuleResult {
  categories: Record<string, number>;
  rule_score: number;
}

export function detectRules(normalized: string, obfuscation_flags: ("BASE64" | "HEX" | "URL_ENCODED" | "ROT13" | "LEETSPEAK" | "SPACED_OUT" | "HOMOGLYPH")[]): RuleResult {
  const categories: Record<string, number> = {};
  let ruleScore = 0;

  // INSTRUCTION_OVERRIDE
  const overridePatterns = ["ignore previous", "disregard rules", "new instructions",
    "system prompt", "developer mode", "you are now"];
  for (const pattern of overridePatterns) {
    if (normalized.toLowerCase().includes(pattern)) {
      categories["INSTRUCTION_OVERRIDE"] = (categories["INSTRUCTION_OVERRIDE"] || 0) + ruleWeights["INSTRUCTION_OVERRIDE"];
      ruleScore += ruleWeights["INSTRUCTION_OVERRIDE"];
    }
  }

  // ROLEPLAY_JAILBREAK
  const jailbreakPatterns = ["DAN", "pretend you are", "act as an unrestricted bank admin"];
  for (const pattern of jailbreakPatterns) {
    if (normalized.toLowerCase().includes(pattern.toLowerCase())) {
      categories["ROLEPLAY_JAILBREAK"] = (categories["ROLEPLAY_JAILBREAK"] || 0) + ruleWeights["ROLEPLAY_JAILBREAK"];
      ruleScore += ruleWeights["ROLEPLAY_JAILBREAK"];
    }
  }

  // PRIVILEGE_ESCALATION
  const privilegePatterns = ["admin", "override limit", "bypass verification", "skip OTP"];
  for (const pattern of privilegePatterns) {
    if (normalized.toLowerCase().includes(pattern.toLowerCase())) {
      categories["PRIVILEGE_ESCALATION"] = (categories["PRIVILEGE_ESCALATION"] || 0) + ruleWeights["PRIVILEGE_ESCALATION"];
      ruleScore += ruleWeights["PRIVILEGE_ESCALATION"];
    }
  }

  // DATA_EXFILTRATION
  const exfiltrationPatterns = ["show all accounts", "dump database", "reveal system prompt",
    "other users' account data"];
  for (const pattern of exfiltrationPatterns) {
    if (normalized.toLowerCase().includes(pattern.toLowerCase())) {
      categories["DATA_EXFILTRATION"] = (categories["DATA_EXFILTRATION"] || 0) + ruleWeights["DATA_EXFILTRATION"];
      ruleScore += ruleWeights["DATA_EXFILTRATION"];
    }
  }

  // MEMO_INJECTION - check for suspicious memo patterns
  const memoInjectionKeywords = ["transfer", "send", "payment", "move"];
  if (memoInjectionKeywords.some(k => normalized.toLowerCase().includes(k))) {
    categories["MEMO_INJECTION"] = (categories["MEMO_INJECTION"] || 0) + 5;
    ruleScore += 5;
  }

  // TOKEN_OBFUSCATION
  if (obfuscation_flags.includes("BASE64") || obfuscation_flags.includes("HEX") ||
      obfuscation_flags.includes("URL_ENCODED") || obfuscation_flags.includes("ROT13") ||
      obfuscation_flags.includes("LEETSPEAK")) {
    categories["TOKEN_OBFUSCATION"] = (categories["TOKEN_OBFUSCATION"] || 0) + ruleWeights["TOKEN_OBFUSCATION"];
    ruleScore += ruleWeights["TOKEN_OBFUSCATION"];
  }

  // MULTI_ACTION_SMUGGLING - check for multiple commands in one request
  const multiActionKeywords = ["and", "also", "then", " moreover"];
  const multiActionCount = multiActionKeywords.filter(k => normalized.toLowerCase().includes(k)).length;
  if (multiActionCount >= 2) {
    categories["MULTI_ACTION_SMUGGLING"] = (categories["MULTI_ACTION_SMUGGLING"] || 0) + ruleWeights["MULTI_ACTION_SMUGGLING"];
    ruleScore += ruleWeights["MULTI_ACTION_SMUGGLING"];
  }

  // Cap rule score at 100
  ruleScore = Math.min(ruleScore, 100);

  return {
    categories,
    rule_score: ruleScore
  };
}