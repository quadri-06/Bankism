"use strict";

import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { normalizeInput } from "@/lib/pipeline/normalizer";
import { detectRules } from "@/lib/pipeline/normalizer";
import { classifyWithLLM } from "@/lib/pipeline/llm-classifier";
import { validateInput } from "@/lib/pipeline/validator";
import { generateVerdict } from "@/lib/pipeline/verdict";
import { v4 as uuidv4 } from "uuid";

type ValidateSuccess = {
  success: true;
  validated: any;
  requiresStepUp: boolean;
};

type ValidateFailure = {
  success: false;
  error: string;
  requiresStepUp: boolean;
};

type ValidateResult = ValidateSuccess | ValidateFailure;

export async function POST(request: Request) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Auth gate (Stage 0) - verify Supabase session
    const supa = createClient();

    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized - valid session required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { message, memo } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Initialize stages tracking
    const stages: any[] = [];

    // Stage 1: Input Normalization (Stage 1)
    const normalized = normalizeInput(message);
    stages.push({
      name: "Normalize",
      passed: true,
      score: 0,
      details: `Normalized length: ${normalized.normalized.length}, flags: ${normalized.obfuscation_flags.join(", ")}`
    });

    // Check for obfuscation that requires attention
    const hasObfuscation = normalized.obfuscation_flags.length > 0;

    // Stage 2: Rule-based detection (Stage 2)
    const ruleResult = detectRules(normalized.normalized, normalized.obfuscation_flags);
    stages.push({
      name: "Rules",
      passed: ruleResult.rule_score < 50,
      score: ruleResult.rule_score,
      details: `Rule score: ${ruleResult.rule_score}, categories: ${Object.keys(ruleResult.categories).length}`
    });

    // Stage 3: LLM semantic classifier (Stage 3)
    const llmInput = {
      untrustedInput: message,
      normalizedInput: normalized.normalized
    };

    let llmClassification: any;
    try {
      llmClassification = await classifyWithLLM(llmInput);
    } catch (error) {
      // Fail closed on LLM error
      return NextResponse.json(
        generateVerdict({
          requestId,
          ruleScore: ruleResult.rule_score,
          llmClassification: { intent: "UNKNOWN", threat_category: "NONE", confidence: 0, injected_instructions_found: true, reasoning: "LLM call failed - blocked" },
          validationFlags: { hasAmbiguity: false, requiresStepUp: false, hasInjection: true, details: "LLM error" },
          stages: [{ name: "LLM Classifier", passed: false, score: 0, details: "LLM call error - blocked" }]
        })
      );
    }
    
    stages.push({
      name: "LLM Classifier",
      passed: true,
      score: Math.round(llmClassification.confidence * 100),
      details: llmClassification.reasoning.substring(0, 100)
    });

    // Stage 4: Deterministic validation boundary (Stage 4)
    const memoClassification = await classifyWithLLM({
      untrustedInput: memo || "",
      normalizedInput: memo || ""
    });

    const validationResult = validateInput(
      llmClassification.intent,
      {
        recipient: message.match(/to[\s]+([a-zA-Z0-9\s]+)/i)?.[1]?.trim(),
        amount: parseFloat(message.match(/₹?[\s]*([0-9,]+\.?[0-9]*)/)?.[1]),
      },
      userId,
      [] // Would fetch saved beneficiaries from DB in real implementation
    );

    stages.push({
      name: "Validation",
      passed: validationResult.success,
      score: validationResult.success ? 0 : 50,
      details: "Validated successfully"
    });

    // Stage 5: Risk fusion and verdict (Stage 5)
    // Type-narrowed access to ValidateResult properties
    let validationFlags: any;
    if (validationResult.success) {
      validationFlags = {
        hasAmbiguity: false,
        requiresStepUp: validationResult.requiresStepUp,
        hasInjection: llmClassification.injected_instructions_found || memoClassification.injected_instructions_found,
        details: "No issues"
      };
    } else {
      validationFlags = {
        hasAmbiguity: true,
        requiresStepUp: validationResult.requiresStepUp,
        hasInjection: llmClassification.injected_instructions_found || memoClassification.injected_instructions_found,
        details: validationResult.error || "No issues"
      };
    }

    const verdict = generateVerdict({
      requestId,
      ruleScore: ruleResult.rule_score,
      llmClassification,
      validatedParams: (validationResult as ValidateSuccess).validated,
      validationFlags,
      stages
    });

    // Stage 6: If approved, execute the mock banking service
    let executionResult = null;
    if (verdict.verdict === "approved" && verdict.action === "EXECUTE") {
      // Mock execution - in real app, call server-side function with validated params only
      executionResult = {
        status: "success",
        message: "Transaction executed via mock banking service",
        params: verdict.extracted_params
      };
      
      // Log to audit
      await supa.from("audit_logs").insert({
        request_id: requestId,
        user_id: userId,
        raw_input: message,
        normalized_input: normalized.normalized,
        verdict_json: verdict,
        threat_category: verdict.threat_category,
        risk_level: verdict.risk_level,
        risk_score: verdict.risk_score
      });
    }

    // Log audit
    await supa.from("audit_logs").insert({
      request_id: requestId,
      user_id: userId,
      raw_input: message,
      normalized_input: normalized.normalized,
      verdict_json: verdict,
      threat_category: verdict.threat_category,
      risk_level: verdict.risk_level,
      risk_score: verdict.risk_score
    });

    const latency = Date.now() - startTime;

    return NextResponse.json({
      ...verdict,
      latency,
      execution: executionResult
    }, { status: 200 });

  } catch (error: any) {
    // Fail closed on any error
    return NextResponse.json(
      generateVerdict({
        requestId,
        ruleScore: 0,
        llmClassification: { intent: "UNKNOWN", threat_category: "NONE", confidence: 0, injected_instructions_found: true, reasoning: `System error: ${error.message}` },
        validationFlags: { hasAmbiguity: false, requiresStepUp: false, hasInjection: true, details: "System error - blocked" },
        stages: [{ name: "System", passed: false, score: 0, details: `Error: ${error.message}` }]
      })
    ), { status: 500 };
  }
}