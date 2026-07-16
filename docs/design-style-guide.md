# Stella Force — Design Style Guide

Source of truth for **visual design tokens** (color, type, radius, spacing) and
naming conventions. Companion to `CLAUDE.md`, which owns schema/workflow — this
file owns *how things look*. Keep it in sync with `src/app/globals.css` if they
disagree, this file wins.

**Design sources (Figma):**
- Brand palette — [Logo + Branding](https://www.figma.com/design/711VAkvBOJkN8tr0WTWxCc/Logo---Branding?node-id=2005-100)
- Reference app shell — [S2.0](https://www.figma.com/design/Jly82KMVUnGoW9XOcvACei/S2.0?node-id=3-867)

---

## 1. Token architecture

Two tiers, matching Tailwind v4 / shadcn convention:

1. **Primitives** — raw hue scales, 11 steps each (`50` lightest → `950`
   darkest), named by hue so they're reusable outside any one component.
   Namespaced `brand-*` so they never collide with Tailwind's built-in
   `orange`/`purple`/`neutral` scales (which stay available, unmodified, for
   one-off use like tier badges).
2. **Semantic tokens** — the existing shadcn slots (`primary`, `secondary`,
   `muted`, `accent`, `border`, `ring`, `sidebar-*`…). Each now aliases a
   specific primitive step instead of a flat grayscale value. Components
   should always consume the semantic layer (`bg-primary`, `text-muted-foreground`),
   never a primitive directly, so a future re-theme only touches the alias
   table in `globals.css`.

### Why rename away from the Figma layer names

The branding file's raw layer names (`P 23`, `P 44`, `S 30`…) are artifact IDs
from the design tool, not a naming system — they don't encode lightness order
or hue, so nobody could infer `S 30` is a neutral gray and `S 41` is a
saturated purple without opening the file. Renamed to the standard
50–950 lightness scale, grouped by hue:

| Figma layer | Hex | New token |
|---|---|---|
| P 44 (darkest) | `#2D1106` | `--brand-orange-950` |
| P 43 | `#5A210C` | `--brand-orange-900` |
| P 42 | `#863213` | `--brand-orange-800` |
| P 41 | `#B34219` | `--brand-orange-700` |
| **P 23 (base, labeled `E0531F`)** | `#E0531F` | **`--brand-orange-600`** |
| P 24 | `#E6754C` | `--brand-orange-500` |
| P 25 | `#EC9879` | `--brand-orange-400` |
| P 26 | `#F3BAA5` | `--brand-orange-300` |
| P 27 | `#F9DDD2` | `--brand-orange-200` |
| P 28 | `#FCEEE9` | `--brand-orange-100` |
| P 29 (lightest) | `#FEF8F6` | `--brand-orange-50` |
| S 44 (darkest) | `#180330` | `--brand-purple-950` |
| S 43 | `#300561` | `--brand-purple-900` |
| S 42 | `#480891` | `--brand-purple-800` |
| **S 41 (base, labeled `600AC2`)** | `#600AC2` | **`--brand-purple-700`** |
| S 23 | `#770DF2` | `--brand-purple-600` |
| S 24 | `#933DF5` | `--brand-purple-500` |
| S 25 | `#AE6EF7` | `--brand-purple-400` |
| S 26 | `#C99EFA` | `--brand-purple-300` |
| S 27 | `#E4CFFC` | `--brand-purple-200` |
| S 28 | `#F1E7FE` | `--brand-purple-100` |
| S 29 (lightest) | `#FAF5FE` | `--brand-purple-50` |
| S 40 (darkest) | `#19171C` | `--brand-neutral-950` |
| S 39 | `#332E38` | `--brand-neutral-900` |
| S 38 | `#4C4554` | `--brand-neutral-800` |
| S 37 | `#655C70` | `--brand-neutral-700` |
| S 36 | `#7F738C` | `--brand-neutral-600` |
| S 35 | `#988FA3` | `--brand-neutral-500` |
| S 34 | `#B2ABBA` | `--brand-neutral-400` |
| S 33 | `#CCC7D1` | `--brand-neutral-300` |
| S 32 | `#E5E3E8` | `--brand-neutral-200` |
| S 31 | `#F2F1F4` | `--brand-neutral-100` |
| S 30 (lightest) | `#FAF9FA` | `--brand-neutral-50` |

`--brand-neutral` is a warm, faintly violet-tinted gray (not pure achromatic
gray) — it's what gives the UI a "brand" feel even in places that are
nominally black/white/gray (body text, borders, card surfaces).

---

## 2. Semantic token mapping

`src/app/globals.css` now aliases every shadcn slot to a primitive step
instead of the old flat `oklch(x 0 0)` grayscale. Full list in the file
itself; the key moves:

| Semantic token | Light | Dark | Used for |
|---|---|---|---|
| `--primary` / `--primary-foreground` | `brand-orange-600` / white | `brand-orange-500` / `brand-neutral-950` | Primary buttons, links, "Sign in", "Add candidate" |
| `--ring` | `brand-orange-600` | `brand-orange-500` | Focus rings (matches the orange focus border on the S2.0 task input) |
| `--accent` / `--accent-foreground` | `brand-purple-100` / `brand-purple-800` | `brand-purple-900` / `brand-purple-200` | Hover/highlight wash on menu items, select options |
| `--secondary`, `--muted` | `brand-neutral-100` / `brand-neutral-900` text | `brand-neutral-800` / `brand-neutral-50` text | Low-emphasis surfaces, skill-tag badges, secondary buttons |
| `--sidebar-primary` / `-foreground` | `brand-purple-300` / white | `brand-purple-600` / white | Active nav item — exact match to the S2.0 sidebar |
| `--background`, `--foreground`, `--border`, `--card` | `brand-neutral` 50/950/200/white | `brand-neutral` 950/50/800/900 | Base surfaces and text |
| `--destructive` | unchanged (existing red) | unchanged | Errors — no brand spec for this, left as-is |

`--chart-1..5` cycle through `brand-orange-600`, `brand-purple-600`,
`brand-neutral-700`, `brand-orange-300`, `brand-purple-300` so future charts
stay on-brand without hand-picking colors per chart.

**Deliberately not touched:** `TIER_BADGE_CLASS` in `src/lib/constants.ts`
(gold/silver/bronze candidate tiers). That's a ranking metaphor, not a brand
accent — recoloring it to orange/purple would break the gold/silver/bronze
mental model for recruiters scanning the table.

---

## 3. Typography

Already correct, no change: `--font-sans` is Geist (`--font-geist-sans`),
matching the Figma spec's `Geist:Regular` / `Geist:Medium`. Scale (Tailwind
defaults, already in use):

| Class | Size / line-height | Use |
|---|---|---|
| `text-xs` | 12/16 | Sidebar group labels, badges, timestamps |
| `text-sm` | 14/20 | Body copy, nav labels, table cells |
| `text-base` | 16/24 | Form inputs |
| `text-xl` | 20/none | Page greetings / large headings |
| `text-2xl` | — | Stat counts, page titles |

Weight: `font-medium` (500) for nav items, labels, and active states;
`font-normal` (400) for body copy — matches the Figma frame exactly
(`Geist:Medium` vs `Geist:Regular`).

## 4. Radius & spacing

No change needed — already aligned with the Figma spec:
- `--radius: 0.625rem` (10px) → `--radius-md` resolves to 8px, matching the
  Figma `rounded-md` token used on sidebar items and buttons.
- Pills / avatars / the S2.0 send-button use `rounded-full` (9999px).
- Spacing grid is 4px-based (`gap-1` = 4px, `gap-2` = 8px), matching Figma's
  `--spacing/1` / `--spacing/2`.

## 5. Component conventions

- **Primary CTA** (`Button` default variant): `bg-primary` (brand orange),
  white text. Used for the single main action per view (Sign in, Add
  candidate, Save).
- **Active nav item**: solid `brand-purple-300` background, white text,
  `font-medium` — the one place saturated purple appears as a fill, reserved
  for "you are here" wayfinding so it stays meaningful.
- **Hover/focus accent**: soft `brand-purple-100` wash (menu items, selects) —
  purple as a *highlight*, not a fill, everywhere else.
- **Focus ring**: orange at 50% opacity (`ring-ring/50`), consistent with the
  orange focus border in the S2.0 reference.
- **User avatar**: solid `brand-purple-600` fill, white initials — identity
  marker, echoes the S2.0 avatar treatment.
- **Wordmark**: full "Stellaforce" set in `brand-purple-700` (`brand-purple-300`
  in dark mode) — see `src/components/brand-wordmark.tsx`, shared by the
  sidebar and the login page so the brand color lives in one place.

## 6. Do / don't

- Do consume semantic tokens (`bg-primary`, `text-muted-foreground`) in
  components; don't reach for `brand-orange-600` directly outside
  `globals.css` unless you're building a new semantic mapping.
- Do keep `--destructive` and tier-badge colors as-is — they're functional,
  not brand, colors.
- Don't use saturated `brand-purple` as a large fill outside the active-nav
  and avatar cases above — it reads as *loud* at that saturation; everywhere
  else it should be a 100-level wash or a text/icon accent.
