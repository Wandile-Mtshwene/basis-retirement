// Resolve the pricing API base URL:
// - explicit override via NEXT_PUBLIC_API_URL wins
// - deployed (any non-local host): same-origin, requests hit the Python
//   serverless function mounted at /api
// - local dev: the FastAPI dev server on :8000
const RAW = process.env.NEXT_PUBLIC_API_URL;
function resolveBase(): string {
  if (RAW !== undefined) return RAW.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h !== "localhost" && h !== "127.0.0.1") return ""; // same-origin
  }
  return "http://127.0.0.1:8000";
}
export const API_URL = resolveBase();

export type Step = { step: number; label: string; value: number | string };

export type AssuranceTrace = {
  epv: number;
  years: number[];
  survival: number[];
  death_prob: number[];
  discount: number[];
  expected_discounted: number[];
};

export type Quote = {
  product: string;
  premium: number;
  frequency: string;
  annual_premium: number;
  net_premium_rate: number;
  office_premium_rate: number;
  epv_benefits: number;
  annuity: number;
  table: string;
  inputs: Record<string, unknown>;
  steps: Step[];
  trace?: {
    interest_rate: number;
    expense_loading: Record<string, number>;
    benefits: AssuranceTrace;
    annuity: AssuranceTrace & { frequency: number; frequency_adjustment: number };
  };
};

export type LifeRequest = {
  issue_age: number;
  sex: "male" | "female";
  smoker_status: "nonsmoker" | "smoker";
  sum_assured: number;
  term: number;
  underwriting_class: string;
  frequency: string;
  explain: boolean;
};

export type FuneralRequest = {
  issue_age: number;
  sex: "male" | "female";
  sum_assured: number;
  frequency: string;
  cover_to_age: number;
  explain: boolean;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const priceLife = (req: LifeRequest) => post<Quote>("/api/price/life", req);
export const priceFuneral = (req: FuneralRequest) => post<Quote>("/api/price/funeral", req);

export type RetirementRequest = {
  current_age: number;
  retirement_age: number;
  end_age: number;
  current_savings: number;
  annual_contribution: number;
  contribution_escalation: number;
  expected_return: number;
  return_volatility: number;
  inflation: number;
  target_income: number;
  n_sims: number;
};

export type RetirementProjection = {
  ages: number[];
  percentiles: Record<"p5" | "p25" | "p50" | "p75" | "p95", number[]>;
  capital_at_retirement: Record<"p5" | "p25" | "p50" | "p75" | "p95", number>;
  success_probability: number;
  probability_of_ruin: number;
  median_depletion_age: number | null;
  target_income_first_year: number;
  inputs: Record<string, number>;
  n_sims: number;
};

export const projectRetirement = (req: RetirementRequest) =>
  post<RetirementProjection>("/api/retirement/project", req);

export type CreditRequest = {
  age: number;
  employment_type: "permanent" | "contract" | "self_employed" | "unemployed";
  employment_months: number;
  existing_accounts: number;
  adverse_history: boolean;
  gross_monthly_income: number;
  net_monthly_income: number;
  monthly_living_expenses: number;
  existing_monthly_debt: number;
  loan_amount: number;
  annual_rate: number;
  term_months: number;
};

export type CreditDecision = {
  decision: "approve" | "refer" | "decline";
  installment: number;
  affordability: {
    disposable_income: number;
    installment: number;
    total_debt_after: number;
    debt_to_income: number;
    installment_to_disposable: number;
    affordable: boolean;
    reasons: string[];
  };
  scorecard: {
    score: number;
    probability_of_default: number;
    grade: string;
    breakdown: { characteristic: string; value: string | number; band?: string; points: number }[];
  };
  reasons: string[];
  inputs: Record<string, number | string | boolean>;
};

export const assessCredit = (req: CreditRequest) => post<CreditDecision>("/api/credit/assess", req);

export type ExperienceSegment = {
  [dim: string]: string | number;
  exposure: number;
  actual: number;
  expected: number;
  ae_pct: number;
  credibility: number;
  credible_ae_pct: number;
  ci_low_pct: number;
  ci_high_pct: number;
};

export type ExperienceResult = {
  by: string[];
  segments: ExperienceSegment[];
  overall: ExperienceSegment;
  full_credibility_claims: number;
  expected_basis: string;
};

export const analyseExperience = (by: string[]) =>
  post<ExperienceResult>("/api/experience/analyse", { by });

export type OptionRequest = {
  S: number; K: number; T: number; r: number; sigma: number; q: number;
  option_type: "call" | "put"; n_sims: number;
};

export type OptionResult = {
  option_type: string;
  price: number;
  d1: number;
  d2: number;
  greeks: Record<"delta" | "gamma" | "vega_per_1pct" | "theta_per_day" | "rho_per_1pct", number>;
  monte_carlo: { price: number; std_error: number; ci95: [number, number]; n_sims: number };
  put_call_parity: { call_minus_put: number; forward_value: number; residual: number };
  value_curve: { spot: number; value: number; intrinsic: number }[];
  inputs: Record<string, number | string>;
};

export const priceOption = (req: OptionRequest) => post<OptionResult>("/api/options/price", req);

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const zar = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 }).format(n);
export const num = (n: number, d = 6) =>
  n.toLocaleString("en-ZA", { maximumFractionDigits: d, minimumFractionDigits: 0 });
