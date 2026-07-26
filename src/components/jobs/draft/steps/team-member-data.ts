export const STARTER_ROLES = [
  "Hiring Manager",
  "Interviewer",
  "HR Manager",
  "Approver",
]

export type Member = {
  id: string
  name: string
  email: string
  role: string
}

/**
 * Seeded so the Workflow step has real reviewers to pre-assign to stages.
 */
export const INITIAL_MEMBERS: Member[] = [
  {
    id: "jamie-rivera",
    name: "Jamie Rivera",
    email: "jamie@client.com",
    role: "Hiring Manager",
  },
  {
    id: "alex-kim",
    name: "Alex Kim",
    email: "alex@client.com",
    role: "Interviewer",
  },
]
