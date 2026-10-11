# Bankism: Blue-Team AI Firewall

## Architecture

Bankism is a blue-team AI firewall that sits between untrusted user input and a mock banking API. It implements a **defense-in-depth pipeline** with 6 stages that every request must pass before any banking action is approved.

### Pipeline Stages (in order):

1. **Stage 0: Auth Gate** - Validates Supabase JWT session, rate limits per user (10 req/min)
2. **Stage 1: Input Normalization** - NFKC Unicode normalization, strips zero-width/bidi chars, detects homoglyphs, base64/hex/URL/ROT13/leetspeak detection, spaced-out letter collapsing, max 500 char limit
3. **Stage 2: Rule-Based Detection** - Regex + keyword scoring for INSTRUCTION_OVERRIDE, ROLEPLAY_JAILBREAK, PRIVILEGE_ESCALATION, DATA_EXFILTRATION, MEMO_INJECTION, TOKEN_OBFUSCATION, MULTI_ACTION_SMUGGLING (weights 10-30 each, total capped at 100)
4. **Stage 3: LLM Semantic Classifier** - Groq/Gemini JSON classification with clear delimiters `<untrusted_input>`, forces Zod schema output: {intent, threat_category, confidence, injected_instructions_found, reasoning}
5. **Stage 4: Deterministic Validation Boundary** - Final authority with Zod schema validation: intent must be allowlisted, transfers require beneficiary matching or account ID regex, amount limits (≤50,000 per-transaction, ≤ daily limit), currency allowlist, memo validation (≤100 chars, alphanumeric+punctuation only)
6. **Stage 5: Risk Fusion and Verdict** - Weighted scoring: rule_score×0.4 + llm_confidence×0.3 + validation_flags. Maps to risk_level: LOW (<25), MEDIUM (25-50), HIGH (50-75), CRITICAL (>75). Approve ONLY if risk_level==LOW AND validation passed AND LLM intent allowlisted AND no injection found
7. **Stage 6: Execution** - Mock banking service call with validated parameters only, never from raw text

### Verdict JSON Contract:

```json
{
  "request_id": "uuid",
  "verdict": "approved" | "blocked",
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "risk_score": 0-100,
  "threat_category": "NONE" | "INSTRUCTION_OVERRIDE" | "ROLEPLAY_JAILBREAK" | "PRIVILEGE_ESCALATION" | "DATA_EXFILTRATION" | "MEMO_INJECTION" | "TOKEN_OBFUSCATION" | "MULTI_ACTION_SMUGGLING" | "POLICY_VIOLATION" | "AMBIGUOUS_INPUT",
  "intent": "...",
  "rationale": "clear one-two sentence explanation",
  "stages": [{ "name": "...", "passed": true, "score": 0, "details": "..." }],
  "action": "EXECUTE" | "REJECT" | "REQUIRE_STEP_UP",
  "extracted_params": { ... } | null,
  "timestamp": "ISO8601"
}
```

### Non-Negotiable Security Rules:

- Fail closed on any error, timeout, or malformed LLM output
- The LLM never receives API keys, tools, or DB access
- All secrets in `.env`; never expose the service role key to the client
- Never build SQL or API calls from raw user text
- Log every request to audit_logs
- Include a README with architecture diagram, setup steps, env vars, and how to run the tests

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + lucide-react
- **Backend**: Next.js API routes
- **Auth + DB**: Supabase (Auth, Postgres, RLS)
- **LLM**: Groq API (llama-3.3-70b-versatile) in JSON mode, temperature 0
- **Validation**: Zod (TypeScript) for every schema

## Supabase Setup

### Enable Authentication:
- Email/Password auth + Google OAuth

### Tables (with RLS policies):

| Table | Key Columns | RLS Policy |
|-------|------------|------------|
| `profiles` | id, user_id, full_name | Users read/write own profile |
| `accounts` | id, user_id, account_number, balance, currency | Users own accounts only |
| `beneficiaries` | id, user_id, beneficiary_name, account_number | Users own beneficiaries only |
| `transactions` | id, user_id, amount, currency, status | Users own transactions only |
| `audit_logs` | request_id, user_id, raw_input, verdict_json, threat_category, risk_level, risk_score | Insert-only from server using service role key |

### Seed Data:

- 1 demo user (demo@bankism.com / demo123)
- 2 accounts (Savings: ₹50,000, Checking: ₹15,000)
- 3 beneficiaries (Rahul Kumar, Priya Sharma, Amit Patel)
- Sample transactions (₹5,000, ₹2,000, ₹1,000)

### Environment Variables (.env.example):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## UI Pages

- `/login` - Centered card, Supabase auth, inline validation errors
- `/signup` - Account creation with validation
- `/dashboard` - Left sidebar (Dashboard, Firewall Console, Audit Log, Attack Lab), balance cards, recent transactions table
- `/console` - Chat-style input, animated pipeline stepper (Normalize → Rules → LLM → Validation → Verdict), verdict card with colored badge, risk meter, threat category chip, rationale, collapsible raw JSON viewer with copy button
- `/audit` - Filterable, paginated table of past verdicts (filter by verdict, risk, category), click row for detail drawer
- `/attack-lab` - Preset buttons for sample attacks (roleplay jailbreak, instruction override, memo injection, base64 obfuscation, unicode homoglyph) and benign requests, plus "run all" test suite showing pass/fail counts and detection rate

## Running the Application

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run database migrations
npm run db:migrate  # or run the SQL migration manually

# Seed the database
npm run seed

# Start development server
npm run dev
```

## Testing

### Test Dataset

A dataset of labeled prompts is available in `dataset/labeled_prompts.txt` containing:
- 30 benign prompts (balance inquiries, P2P transfers, transaction history, support questions)
- 30 adversarial prompts across all categories (instruction override, jailbreaks, privilege escalation, data exfiltration, memo injection, base64 obfuscation, unicode homoglyphs, multi-action smuggling)

### Evaluation Script

Run the evaluation script:

```bash
npm run eval
```

Or run directly:

```bash
node scripts/eval.js
```

**Target metrics:**
- Attack block rate: >95%
- False positive rate: <5%
- Per-category recall: varies by category
- Average latency: ~1-2 seconds

### TypeScript Compilation

The project uses `tsconfig.json` with path aliases `@/*` → `./src/*`. Some page component imports may require relative paths due to Next.js App Router module resolution behavior.

## Deliverables

- Working Next.js 14 repository with all UI pages
- Supabase SQL migration with RLS policies
- Seed script for demo data
- Test dataset (60+ labeled prompts) + evaluation script
- README with architecture diagram, setup steps, env vars, and test instructions
- `.env.example` with all required environment variables
- Pipeline stage implementations (normalizer, rules, LLM classifier, validation, verdict)
- Full audit log system