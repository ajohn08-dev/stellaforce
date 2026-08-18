import type { AgentUse } from "@/lib/company-visibility"
import type { FaqCategory } from "@/lib/mock-companies"

/**
 * **The question catalog — the one thing shared across every customer.**
 *
 * A question is the same question everywhere. *"Do you sponsor visas?"* is asked
 * at LumaGrid, at Verity, and at the fortieth company we sign; only the answer
 * differs. So the question lives here once, globally, and companies own only
 * answers (`CompanyQuestion.answers`, resolved by
 * `src/lib/company-inheritance.ts`).
 *
 * Splitting them is what makes this scale past one customer:
 *
 *  - **Onboarding is generated, not typed.** A new company starts with the whole
 *    catalog and no answers, so its Unanswered inbox *is* the intake checklist on
 *    day one instead of a blank page.
 *  - **Safe before anyone configures anything.** A `sensitive` question arrives
 *    carrying its prohibitions and an escalate-by-default posture, so company #40
 *    is safe because the catalog is — not because somebody remembered.
 *  - **It compounds.** A question candidates start asking at one company is
 *    promoted here once, and every other company immediately sees it as
 *    unanswered.
 *  - **Rollups are one query.** "Sponsorship unanswered at 7 of 12 companies"
 *    only works when it's one question id.
 *
 * **Answers are never shared between customers.** Not as templates, not as
 * "copy from a similar company". That is exactly how an agent ends up stating
 * another client's policy, and no amount of convenience is worth it. Questions,
 * phrasings, categories, and prohibitions travel; answers never do.
 */

export type Question = {
  id: string
  /** The canonical phrasing a recruiter reads. */
  intent: string
  category: FaqCategory
  /** Other ways candidates ask the same thing, for intent matching. */
  variants: string[]
  /**
   * Topics where a wrong answer is a legal or commercial problem, not an
   * awkward moment: immigration, compensation, financial health.
   *
   * A sensitive question defaults to `escalate` at every company until someone
   * writes an approved answer, and carries `prohibitions` that no narrower scope
   * can remove.
   */
  sensitive: boolean
  /** Applied at every company unless a company answer overrides the posture. */
  defaultAgentUse: AgentUse
  /**
   * Standing constraints for this topic. **These accumulate — a company or role
   * may add to them and can never remove one.** Answers override; prohibitions
   * only ever union.
   */
  prohibitions: string[]
}

const SPONSORSHIP_PROHIBITIONS = [
  "Never state or imply that sponsorship is guaranteed.",
  "Never predict an immigration outcome or timeline.",
  "Never advise on immigration eligibility.",
]

const COMP_PROHIBITIONS = [
  "Never confirm a specific offer figure.",
  "Never suggest a number is negotiable or that an exception is possible.",
  "Never compare compensation to another company or another candidate.",
]

const FINANCIAL_PROHIBITIONS = [
  "Never give a specific revenue, runway, or growth figure.",
  "Never speculate about layoffs, funding, or an acquisition.",
]

/** Convenience for the many ordinary questions with no standing constraints. */
function q(
  id: string,
  intent: string,
  category: FaqCategory,
  variants: string[]
): Question {
  return {
    id,
    intent,
    category,
    variants,
    sensitive: false,
    defaultAgentUse: "on_request",
    prohibitions: [],
  }
}

/** Sensitive: escalate until answered, and the prohibitions ride along. */
function sensitive(
  id: string,
  intent: string,
  category: FaqCategory,
  variants: string[],
  prohibitions: string[]
): Question {
  return {
    id,
    intent,
    category,
    variants,
    sensitive: true,
    defaultAgentUse: "escalate",
    prohibitions,
  }
}

export const GLOBAL_QUESTIONS: Question[] = [
  q("q-company-size", "How big is the company?", "size_growth", [
    "How many employees do you have?",
    "Is this a startup?",
    "How fast are you growing?",
    "How many employees?",
  ]),
  q("q-culture", "What is the culture like?", "culture", [
    "What's it like to work there?",
    "How would you describe the team?",
    "Is it a fast-paced environment?",
  ]),
  sensitive(
    "q-visa-sponsorship",
    "Do you sponsor visas?",
    "work_authorization",
    [
      "Can you sponsor H-1B?",
      "Do you do green card sponsorship?",
      "Will you transfer my H-1B?",
      "Do I need to already have work authorization?",
    ],
    SPONSORSHIP_PROHIBITIONS
  ),
  sensitive(
    "q-new-h1b-petition",
    "Would you file a new H-1B petition, not just a transfer?",
    "work_authorization",
    [],
    SPONSORSHIP_PROHIBITIONS
  ),
  sensitive(
    "q-comp-approach",
    "How does compensation work?",
    "comp_philosophy",
    ["What's the salary?", "Is the commission capped?", "How is the split between base and variable?"],
    COMP_PROHIBITIONS
  ),
  sensitive(
    "q-quota-attainment",
    "What's the quota, and what share of the team hit it last year?",
    "comp_philosophy",
    [],
    COMP_PROHIBITIONS
  ),
  sensitive(
    "q-financial-stability",
    "Is the company financially stable?",
    "financial_stability",
    ["Are you profitable?", "How much runway?", "Any layoffs recently?"],
    FINANCIAL_PROHIBITIONS
  ),
  q("q-remote", "Is this role remote?", "remote_model", [
    "Do I have to be in Austin?",
    "How many days in office?",
    "Can I work from anywhere in the US?",
    "Can I work from home?",
    "Is there any hybrid option?",
  ]),
  q("q-interview-process", "What does the interview process look like?", "interview_process", [
    "How many rounds?",
    "How long does it take?",
    "Who will I meet?",
  ]),
  q("q-product", "What does the product actually do?", "products_customers", [
    "What do you sell?",
    "Who are your customers?",
    "Is this hardware or software?",
  ]),
  q("q-why-role-open", "Why is this role open?", "why_role_open", [
    "Is this a backfill?",
    "Did someone leave?",
    "Is this a new position?",
  ]),
  q("q-benefits", "What benefits do you offer?", "benefits", [
    "What's the health insurance like?",
    "Is there a 401k match?",
    "How much PTO?",
  ]),
  q("q-wellness-benefit", "Do you offer a wellness or mental-health benefit?", "benefits", []),
  q("q-typical-week", "What does a typical week look like on this team?", "typical_day", [
    "What would I actually be doing?",
    "How much of it is travel?",
  ]),
  q("q-reporting-line", "Who would I report to?", "leadership", [
    "Who's the hiring manager?",
    "What's the reporting structure?",
  ]),
  q("q-travel", "How much travel is involved?", "travel", [
    "Is this a road job?",
    "How many nights away?",
  ]),
  q("q-team-collaboration", "How does the go-to-market team work together?", "team_collaboration", [
    "Who would I work with?",
    "Is there sales engineering support?",
  ]),
  q("q-hiring-timeline", "How long will the process take?", "hiring_timeline", [
    "When do you want someone to start?",
    "Is the req still open?",
  ]),
]

const BY_ID = new Map(GLOBAL_QUESTIONS.map((qq) => [qq.id, qq]))

/**
 * Look a question up in the global catalog, then in the company's own.
 *
 * Company-scoped questions exist for the genuinely bespoke — *"Is the Central
 * territory an existing book of business or greenfield?"* is not a question any
 * other customer's candidates will ask. They're the exception; anything a second
 * company would recognise belongs in the catalog above, where every customer
 * gets it.
 */
export function findQuestion(
  id: string,
  companyQuestions: Question[] = []
): Question | undefined {
  return BY_ID.get(id) ?? companyQuestions.find((qq) => qq.id === id)
}
