"use client";

import { useState } from "react";
import { useSupabase } from "../../lib/supabase/client";
import { 
  Mail, MessageCircle, Microscope, Shield, 
  Layout, LayoutDashboard, Users, BarChart3,
  LogIn, UserPlus, Loader2, TrendingUp,
  MessageSquare, MessageSquareWarning,
  FolderDown, FolderSearch, Settings,
  LogOut
} from "lucide-react";
import { cn } from "../../lib/utils";
import { v4 as uuidv4 } from "uuid";

export default function ConsolePage() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<{
    normalize: boolean; rules: boolean; llm: boolean; validation: boolean;
  }>({ normalize: false, rules: false, llm: false, validation: false });
  const [verdict, setVerdict] = useState<{
    verdict: string; riskLevel: string; riskScore: number; threatCategory: string;
    rationale: string; action: string; extractedParams: any;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const { session } = useSupabase();

  if (!session) {
    return null;
  }

  const processRequest = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    
    // Stage 1: Normalize
    setPipelineStages({ normalize: true, rules: false, llm: false, validation: false });
    const normalized = normalizeInput(input);
    setPipelineStages({ normalize: false, rules: true, llm: false, validation: false });
    
    // Stage 2: Rules
    const ruleResult = detectRules(normalized.normalized, normalized.obfuscation_flags);
    
    // Stage 3: LLM Classifier
    setPipelineStages({ normalize: false, rules: false, llm: true, validation: false });
    const llmInput = { untrustedInput: input, normalizedInput: normalized.normalized };
    let llmClassification: any;
    try {
      llmClassification = await classifyWithLLM(llmInput);
    } catch {
      llmClassification = { intent: "UNKNOWN", threat_category: "NONE", confidence: 0, injected_instructions_found: true, reasoning: "LLM call failed" };
    }
    
    // Stage 4: Validation
    setPipelineStages({ normalize: false, rules: false, llm: false, validation: true });
    const memoClassification = await classifyWithLLM({
      untrustedInput: normalized.normalized,
      normalizedInput: normalized.normalized
    });
    
    const validationResult = validateInput(
      llmClassification.intent,
      {
        recipient: input.match(/to[\s]+([a-zA-Z0-9\s]+)/i)?.[1]?.trim(),
        amount: parseFloat(input.match(/₹?[\s]*([0-9,]+\.?[0-9]*)/)?.[1]),
      },
      session.user.id,
      []
    );
    
    // Stage 5: Verdict
    const validationFlags = {
      hasAmbiguity: !validationResult.success,
      requiresStepUp: validationResult.requiresStepUp,
      hasInjection: llmClassification.injected_instructions_found || memoClassification.injected_instructions_found,
      details: validationResult.error || "No issues"
    };
    
    const requestId = uuidv4();
    const verdictResult = generateVerdict({
      requestId,
      ruleScore: ruleResult.ruleScore,
      llmClassification,
      validatedParams: validationResult.validated,
      validationFlags,
      stages: [
        { name: "Normalize", passed: true, score: 0, details: `Length: ${normalized.normalized.length}` },
        { name: "Rules", passed: ruleResult.ruleScore < 50, score: ruleResult.ruleScore, details: `Score: ${ruleResult.ruleScore}` },
        { name: "LLM Classifier", passed: true, score: Math.round(llmClassification.confidence * 100), details: llmClassification.reasoning.substring(0, 50) },
        { name: "Validation", passed: validationResult.success, score: validationResult.success ? 0 : 50, details: validationResult.error || "Valid" }
      ]
    });
    
    setVerdict(verdictResult);
    setHistory(prev => [{ id: String(Date.now()), input, verdict: verdictResult, timestamp: new Date().toISOString() }].concat(prev.slice(0, 9)));
    setInput("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-neutral-900">
      <nav className="bg-white dark:bg-neutral-800 border-b border-zinc-200/50">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Bankism Firewall Console</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Welcome, {session.user.email?.split('@')[0] || 'User'}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {/* Pipeline Stepper */}
        {verdict && (
          <div className="mb-6 p-4 rounded-xl border" style={{ borderColor: verdict.action === 'EXECUTE' ? 'green-500' : verdict.action === 'REQUIRE_STEP_UP' ? 'yellow-500' : 'red-500' }}>
            <h2 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">Pipeline Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className={pipelineStages.normalize ? 'text-green-500' : 'text-zinc-400'} size={16} />
                <span className={pipelineStages.normalize ? 'text-green-600' : 'text-zinc-500'}>Normalize</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className={pipelineStages.rules ? 'text-green-500' : 'text-zinc-400'} size={16} />
                <span className={pipelineStages.rules ? 'text-green-600' : 'text-zinc-500'}>Rules</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className={pipelineStages.llm ? 'text-green-500' : 'text-zinc-400'} size={16} />
                <span className={pipelineStages.llm ? 'text-green-600' : 'text-zinc-500'}>LLM</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className={pipelineStages.validation ? 'text-green-500' : 'text-zinc-400'} size={16} />
                <span className={pipelineStages.validation ? 'text-green-600' : 'text-zinc-500'}>Validation</span>
              </div>
            </div>
          </div>
        )}

        {/* Verdict Card */}
        {verdict && (
          <div className="mt-6 p-6 rounded-2xl border" style={{
            borderColor: verdict.action === 'EXECUTE' ? 'green-500' : verdict.action === 'REQUIRE_STEP_UP' ? 'amber-500' : 'red-500',
            background: verdict.action === 'EXECUTE' ? 'green-50' : verdict.action === 'REQUIRE_STEP_UP' ? 'amber-50' : 'red-50'
          }}>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Verdict</h2>
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                verdict.action === 'EXECUTE' ? 'bg-green-100 text-green-800' :
                verdict.action === 'REQUIRE_STEP_UP' ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-800'
              }`}>
                {verdict.action}
              </span>
              <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                verdict.riskLevel === 'LOW' ? 'bg-green-100 text-green-800' :
                verdict.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                verdict.riskLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                'bg-red-100 text-red-800'
              }`}>
                {verdict.riskLevel}
              </span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">{verdict.rationale}</p>
            
            {/* Extracted params */}
            {verdict.extractedParams && Object.keys(verdict.extractedParams).length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-neutral-800">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Extracted Parameters</h3>
                <div className="grid grid-cols-2 gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                  {verdict.extractedParams.intent && <div>Intent: {verdict.extractedParams.intent}</div>}
                  {verdict.extractedParams.recipient && <div>Recipient: {verdict.extractedParams.recipient}</div>}
                  {verdict.extractedParams.amount && <div>Amount: ₹{verdict.extractedParams.amount}</div>}
                  {verdict.extractedParams.currency && <div>Currency: {verdict.extractedParams.currency}</div>}
                  {verdict.extractedParams.memo && <div>Memo: {verdict.extractedParams.memo}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100 mb-4">Send Request</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              processRequest();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-2">Input Message</label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Send ₹500 to Rahul / Check my balance / Show transaction history"
                rows={3}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-3 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition-colors"
                required
              >{input}</textarea>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-white font-medium text-sm hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Run Through Firewall"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}