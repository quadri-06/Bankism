"use strict";

import { z } from "zod";

// Stage 4: Deterministic validation boundary
const intentSchema = z.enum(["balance_inquiry", "p2p_transfer", "transaction_history"]);

const balanceInquirySchema = z.object({
  intent: z.literal("balance_inquiry"),
  account_id: z.string().optional()
});

const p2pTransferSchema = z.object({
  intent: z.literal("p2p_transfer"),
  recipient: z.string().min(1, "Recipient is required"),
  amount: z.number()
    .positive("Amount must be positive")
    .max(50000, "Amount exceeds per-transaction limit")
    .refine(
      (val) => {
        const decimalPart = val.toString().split(".")[1];
        return decimalPart ? decimalPart.length <= 2 : true;
      },
      { message: "Amount must have at most 2 decimal places" }
  ),
  currency: z.enum(["INR", "USD", "EUR"]).default("INR"),
  memo: z.string().max(100, "Memo must be <= 100 chars").optional().refine(
    (val) => !val || /^[a-zA-Z0-9 .,!?'-]+$/.test(val),
    { message: "Memo must be alphanumeric + basic punctuation only" }
  )
});

const transactionHistorySchema = z.object({
  intent: z.literal("transaction_history")
});

const validationSchema = z.discriminatedUnion("intent", [
  balanceInquirySchema,
  p2pTransferSchema,
  transactionHistorySchema
]);

export interface ValidatedParams {
  intent: "balance_inquiry" | "p2p_transfer" | "transaction_history";
  account_id?: string;
  recipient?: string;
  amount?: number;
  currency?: string;
  memo?: string;
}

// Type-narrowed validation result
type ValidateSuccess = {
  success: true;
  validated: ValidatedParams;
  requiresStepUp: boolean;
};

type ValidateFailure = {
  success: false;
  error: string;
  requiresStepUp: boolean;
};

export type ValidateResult = ValidateSuccess | ValidateFailure;

function extractParamsFromResult(result: z.infer<typeof validationSchema>): ValidatedParams {
  const intent = result.intent;
  switch (intent) {
    case "balance_inquiry": {
      const parsed = balanceInquirySchema.safeParse(result);
      if (parsed.success) {
        return {
          intent: "balance_inquiry",
          account_id: parsed.data.account_id
        };
      }
      return { intent: "balance_inquiry" };
    }
    case "p2p_transfer": {
      const parsed = p2pTransferSchema.safeParse(result);
      if (parsed.success) {
        return {
          intent: "p2p_transfer",
          recipient: parsed.data.recipient,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          memo: parsed.data.memo
        };
      }
      return { intent: "p2p_transfer" };
    }
    case "transaction_history": {
      const parsed = transactionHistorySchema.safeParse(result);
      if (parsed.success) {
        return { intent: "transaction_history" };
      }
      return { intent: "transaction_history" };
    }
    default:
      return { intent: "balance_inquiry" };
  }
}

export function validateInput(
  intent: "balance_inquiry" | "p2p_transfer" | "transaction_history",
  params: Partial<{ recipient: string; amount: number; currency: string; memo: string }>,
  userId: string,
  savedBeneficiaries: string[]
): ValidateResult {
  try {
    const result = validationSchema.parse({ intent, ...params });
    
    let requiresStepUp = false;
    
    // Check for ambiguity - missing/multiple recipients or amounts
    if (result.intent === "p2p_transfer") {
      // Recipient validation - must be in beneficiaries or match account ID regex
      const accountIdRegex = /^10000\d{2}$/;
      const isSavedBeneficiary = savedBeneficiaries.includes(result.recipient!);
      const matchesRegex = accountIdRegex.test(result.recipient!);
      
      if (!isSavedBeneficiary && !matchesRegex) {
        return {
          success: false,
          error: "Recipient not in saved beneficiaries and doesn't match account ID format",
          requiresStepUp: true
        };
      }
      
      // New beneficiary = step up
      if (!isSavedBeneficiary) {
        requiresStepUp = true;
      }
      
      // Amount checks
      if (result.amount > 50000) {
        requiresStepUp = true;
      }
    }
    
    // Balance inquiry only for user's own accounts
    if (result.intent === "balance_inquiry") {
      // Would check user's accounts in real implementation
    }
    
    const validated: ValidatedParams = extractParamsFromResult(result);
    
    return {
      success: true,
      validated,
      requiresStepUp
    };
    
  } catch (error: any) {
    if (error.errors) {
      return {
        success: false,
        error: error.errors[0].message,
        requiresStepUp: false
      };
    }
    return {
      success: false,
      error: "Invalid input format",
      requiresStepUp: false
    };
  }
}