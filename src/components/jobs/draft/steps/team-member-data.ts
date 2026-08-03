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
 * Empty by default — team members are now persisted on publish and each one
 * triggers a real "connect your Google Calendar" invite email, so this can no
 * longer be pre-seeded with placeholder people (it previously was, back when
 * this list was purely local UI state that publish silently discarded).
 */
export const INITIAL_MEMBERS: Member[] = []
