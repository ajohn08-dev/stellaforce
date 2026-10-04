---
name: stellaforce-slides
description: Build or edit Stellaforce presentation slides in Figma — stakeholder decks, pitch decks, board reviews, QBRs, internal readouts. Use whenever the task is making, restyling, or reviewing slides/a deck/a presentation for Stellaforce, or when someone asks for a slide layout, a chart on a slide, or a deck header rewrite. Carries the canvas grid, the slide/* type styles, the colour roles, the validated chart palette, the 16 master layouts and their Figma node IDs, plus the Plugin API gotchas that have already cost a debugging cycle. Not for the product UI — that is the app design style guide.
---

# Stellaforce slides

The slide design system lives in Figma, not in this repo. This skill tells you
where it is, what the rules are, and how to build against it without
rediscovering the same three bugs.

**Rule zero: never draw a slide from scratch.** Sixteen masters exist. Clone one.

## Before any Figma write

Load the `figma-use` skill first — it is a hard prerequisite for `use_figma` and
skipping it causes failures that are tedious to diagnose. Prefer the `/figma-use`
slash command; otherwise read the `skill://figma/figma-use/SKILL.md` MCP resource.

## Sources of truth

Everything lives in one Figma file — **Logo + Branding**,
`fileKey: 711VAkvBOJkN8tr0WTWxCc` (the value `use_figma` needs).

<https://www.figma.com/design/711VAkvBOJkN8tr0WTWxCc/Logo---Branding>

| What | Node | Open |
|---|---|---|
| **Slide Design Guide** (this system, documented) | `2041:109` · root frame `2041:110` | [open](https://www.figma.com/design/711VAkvBOJkN8tr0WTWxCc/Logo---Branding?node-id=2041-109) |
| **Slide masters** — "Slide masters v2 — 1920 × 1080" | `2047:104` | [open](https://www.figma.com/design/711VAkvBOJkN8tr0WTWxCc/Logo---Branding?node-id=2047-104) |
| App Design Style Guide (product UI, **not** slides) | `2031:100` | [open](https://www.figma.com/design/711VAkvBOJkN8tr0WTWxCc/Logo---Branding?node-id=2031-100) |
| Brand palette source (original P/S swatches) | `2005:100` | [open](https://www.figma.com/design/711VAkvBOJkN8tr0WTWxCc/Logo---Branding?node-id=2005-100) |
| Logo vectors (hidden scaffold `2038:100`) | lockup `2038:101` · mark `2038:117` · wordmark `2038:120` | — |
| Variables | `Primitives` (colour ramps) · `Semantic` (`core/*`, Light `2030:1` / Dark `2030:2`) | — |

**Worked example deck** — GTM & Value Framework, 30 slides already rebuilt
against these tokens. A Figma **Slides** file, so `/slides/` not `/design/`:
`fileKey: uW3bAXaOOzqV7hr4zfRam6`

<https://www.figma.com/slides/uW3bAXaOOzqV7hr4zfRam6>

**Reference app shell** (where the S2.0 sidebar and focus treatments come from):
<https://www.figma.com/design/Jly82KMVUnGoW9XOcvACei/S2.0?node-id=3-867>

**In this repo:** [`docs/design-style-guide.md`](../../../docs/design-style-guide.md)
is the app's token source of truth — colour, type, radius, spacing for the
product UI. It says nothing about slides, and the slide system deliberately
diverges from it in two places (purple as a categorical fill; the chart palette).

Slides use **primitives directly** (`brand-orange/600`, `brand-neutral/950`,
`base/white`). The `core/*` semantic layer is the app's, and means nothing here —
a slide has no hover or active state.

## Canvas & grid

- **1920 × 1080**, 16:9. Never resize a slide; change the layout.
- **120 px margin** all sides. Only a full-bleed background crosses it.
- **12 columns × 118 px, 24 px gutters** → 1680 px content width.
- **8 px vertical rhythm.** Spacing scale: 8 / 16 / 24 / 32 / 48 / 64 / 96 / 120.
  (Double the app's 4 px grid — a slide is read at roughly twice the size.)
- Radius: `sm 8 · md 12 · lg 20 · full 9999`.
- Fixed y-positions, and they are load-bearing: **eyebrow 112 · headline 154 ·
  content 400 · footer rule 958 · footer text 982**. When these drift slide to
  slide the deck flickers as you page through it.

## The header formula — the thing most decks get wrong

Three parts, top to bottom:

```
EYEBROW            slide/eyebrow · mono · brand-orange/600 · y 112
The assertion      slide/headline · 44 px · brand-neutral/950 · y 154
Supporting line    slide/deck · 26 px · brand-neutral/600 · optional
```

- The headline is **the takeaway, as a sentence with a verb, in sentence case.**
  Not a topic label. "Hiring fails upstream, long before anyone screens a résumé"
  — not "PROBLEMS WE SOLVE".
- **Headline is near-black, never orange.** Orange is spent on the data.
- The eyebrow keeps the topic, so navigation is not lost.
- Max two lines (~90 characters at 44 px). Three lines means two slides.
- **The test:** read every headline in the deck in order, with nothing else. They
  should form the argument. If they read as a table of contents, the deck has
  topics, not an argument.
- If you cannot write the assertion, the slide has no point yet. Layout will not
  give it one.

## The footer

On every content slide; omitted on cover and dividers, which already say all of it.

```
2 px brand-neutral/200 hairline, x 120→1800, y 958
"Stellaforce · Confidential"   slide/footer · brand-neutral/500 · left,  y 982
"Section   ·   07"             slide/footer · brand-neutral/500 · right, y 982
```

Right-aligned to the 1800 margin. Section name first, so a forwarded screenshot
still says which part of the deck it came from.

**Logo:** 40 px tall, top right at `x = 1800 − 207, y = 108`. It is a signature,
not a headline. Clone `2038:101` and `rescale(40 / node.height)`.

## Type styles — all 13 exist as `slide/*` in the Figma file

Apply the style; never type a size.

| Style | px / lh | Weight | Use |
|---|---|---|---|
| `slide/cover-title` | 96 / 104 | Medium | Cover + divider titles |
| `slide/kpi` | 72 / 78 | Medium | Stat value, hero figure |
| `slide/statement` | 64 / 76 | Medium | One idea per slide; pull quotes |
| `slide/headline` | 44 / 54 | Medium | **The assertion** |
| `slide/title` | 36 / 44 | Medium | ⚠️ superseded caps topic label |
| `slide/subhead` | 30 / 38 | Medium | Column + card titles |
| `slide/deck` | 26 / 36 | Regular | Supporting line |
| `slide/label` | 24 / 32 | Medium | Table headers, chips, lead-ins |
| `slide/body` | 24 / 34 | Regular | Body copy, bullets |
| `slide/body-sm` | 22 / 32 | Regular | Dense tables only |
| `slide/caption` | 20 / 28 | Regular | Footnotes, sources |
| `slide/eyebrow` | 20 / 26 | Medium, +8% | Topic kicker |
| `slide/footer` | 16 / 22 | Regular | Footer only |

Geist throughout. **Weight is binary** — Medium for structural, Regular for read.
Nothing uses SemiBold or Bold. **Never below 20 px**; at 1920 that is already a
~10 pt footnote in the room.

## Colour roles

| Role | Tokens | Rule |
|---|---|---|
| **Neutral carries content** | `brand-neutral/950 · 600 · 300 · 100` | Default. A slide built only from these is on brand. |
| **Orange is the one thing to look at** | `brand-orange/600 · 300` | **At most one per slide.** Two means neither is the point. |
| **Purple is structure and data** | `brand-purple/600 · 300 · 200` | Categorical — diagram boxes, timeline bars, chips. Never emphasis. |

**This deliberately inverts one app rule.** The app guide bans saturated purple as
a large fill (there it means "you are here"). Slides have no navigation to compete
with, and a roadmap needs six bars reading as one family — so purple becomes the
categorical fill and the one-per-slide restriction moves to orange.

## Charts — validated, not chosen by eye

Load the `dataviz` skill before building any chart, stat tile or KPI row.

**The palette was run through `validate_palette.js`. Two findings:**

1. **The app's `--chart-1..5` cycle is NOT chart-safe.** `orange-300` and
   `purple-300` sit at **1.65:1 and 2.1:1** contrast on white — under the 3:1
   floor — and fall outside the usable lightness band. Fine as slide fills, wrong
   as chart series. CLAUDE.md's claim that the cycle keeps charts on-brand
   "without hand-picking colors" does not hold.
2. **What passes: `#E0531F` + `#770DF2`.** All five checks; ΔE 34 protan, 31
   tritan. Adding any third brand hue fails — `neutral-700` drops below the chroma
   floor and reads grey rather than as a third identity.

So:

- **Two categorical series is the ceiling.** A third thing is grey
  (`brand-neutral/400`) = context / "other" / the de-emphasised rest.
- More than two real series → small multiples, a table, or fold the tail into Other.
- Magnitude → **one hue, light→dark** from a single ramp. Never a rainbow.
- **Prefer emphasis over categorical**: one orange bar, the rest grey, says more
  than five coloured ones.

**Mark specs, doubled for the 1920 canvas:**

- Bars ≤ **48 px** thick, **8 px rounded data-end, square at the baseline**
  (set `topRightRadius`/`bottomRightRadius` only, for a bar growing right).
- Lines **4 px**, round cap and join.
- End markers ≥ **16 px** with a **4 px** `base/white` ring (`strokeAlign: 'OUTSIDE'`).
- Gridlines **2 px solid** `brand-neutral/200`. Never dashed, never heavier than data.
- **4 px surface gap** between touching fills. Never a border to separate marks.

**Always:** legend present for two series, absent for one. Direct-label
*selectively* — the endpoint, the extreme, the one series the slide is about.
**Text never wears the series colour**; identity comes from the coloured mark
beside it.

**Never:** dual-axis charts · pie/donut for close values or two slices · a value
ramp on unordered categories · recolouring survivors when a series is filtered out.

## The 16 masters — clone, don't draw

| # | Node ID | Layout | Use when |
|---|---|---|---|
| 01 | `2047:106` | Cover | Opens the deck. One per deck. |
| 02 | `2047:128` | Agenda | What will be *decided*, numbered. |
| 03 | `2047:167` | Section divider | Only full-bleed dark slide. Never two in a row. |
| 04 | `2047:174` | Executive summary | Findings + the ask on one page. |
| 05 | `2047:209` | Headline + points | The workhorse. 5 comfortable, 7 max. |
| 06 | `2047:247` | Two column | Today vs with-us; before vs after. |
| 07 | `2047:290` | Three cards | Three parallel items of equal weight. |
| 08 | `2047:327` | Pull quote | One attributed customer sentence. |
| 09 | `2048:100` | KPI row | Four headline numbers; one orange. |
| 10 | `2048:141` | Bar chart | Emphasis form, horizontal. |
| 11 | `2048:184` | Trend, two series | Change over time. |
| 12 | `2048:230` | Process flow | Sequential stages, one highlighted. |
| 13 | `2048:289` | Comparison table | Dots and dashes, never ticks/crosses. |
| 14 | `2048:354` | Positioning matrix | Two axes, five players. |
| 15 | `2048:395` | Roadmap | Swimlanes; only committed work is orange. |
| 16 | `2048:452` | Next steps | Dark close: decisions, owners, dates. Never "thank you". |

A 17th layout is a decision, not a convenience — add it to the holder as a master
first, so the next person finds it. Nothing is centred except the cover.

## Building a deck

1. Load `figma-use`. Load `dataviz` too if any slide has a chart.
2. Read the target file first (`editorType`, pages, existing styles/variables).
   Figma **Slides** files are `/slides/` URLs and behave differently — see gotchas.
3. Clone masters from `2047:104` into the deck, or rebuild the master's structure
   if cloning across files loses variable bindings (it does — see Known gaps).
4. Write headlines **first**, as assertions. Read them in order before laying
   anything out.
5. Fill content. Keep to three type sizes per slide.
6. Screenshot and look at it. The validator checks colour, not layout — clipped
   labels and collisions only show up visually.

## Plugin API gotchas — each of these already cost a cycle

- **Vectors: normalize both axes yourself.** Setting `vectorPaths` and relying on
  Figma's bbox normalization silently shifts the line off its plot. Subtract
  `minX`/`minY` from every point in the path data, then set `node.x = minX;
  node.y = minY` explicitly.
- **Never read a property off a node you just removed.** Collect → filter →
  remove. `if (a) t.remove(); if (t.characters…)` throws on the second line.
- **`scaleFactor` is not a TEXT property.** There is no such thing; use `rescale()`
  on a frame.
- **Text styles:** `setTextStyleIdAsync` is async and changes height. Set
  `characters` → `await setTextStyleIdAsync` → *then* size and position.
- **Absolute-positioned text:** `textAutoResize = 'HEIGHT'` *then* `resize(w, h)`.
- **Load every font before any text mutation**, including fonts already on the
  node you are editing. Geist styles are `SemiBold`, not `Semi Bold` (Inter is
  the opposite — that is a real footgun).
- **Page context resets every call.** `await figma.setCurrentPageAsync(page)` once
  per call, at most.
- **Return every created/mutated node ID**, and pass them into the next call as
  string literals. No state survives between calls.
- **A failed script rolls back.** Write idempotent scripts (remove-then-rebuild by
  name) so a retry is clean.
- **Figma Slides specifics:** `figma.createPage()` does not exist; slides are
  `SLIDE` nodes; `SHAPE_WITH_TEXT` carries its text in a `.text` sublayer that
  needs its own font load and `getStyledTextSegments`.

## Known gaps — say these out loud rather than working around them silently

- **No status palette.** No green/red pair meaning good/bad, so KPI deltas carry
  direction with an arrow and words, not colour. Do not fake it with orange or
  purple — they already mean emphasis and identity.
- **No diverging pair**, so above/below-baseline charts have no honest encoding.
- **No reversed logo.** The wordmark is baked `#3F0B79` and goes illegible on dark,
  which is why section dividers omit the logo entirely. Not a style choice.
- **Primitives are hidden from Figma's property pickers** (`scopes: []`) to enforce
  the app's "consume semantic tokens" rule. Slide masters legitimately need
  primitives directly, so editing a master by hand in the UI cannot pick
  `brand-orange/600` from the picker. Bindings made in code still resolve. Worth
  fixing if slides are edited by hand often.
- **Variables and styles are local to Logo + Branding.** Another file only gets
  live bindings once that file is published as a library; a pasted master keeps
  the right colours but loses the binding. Publishing is a workspace action —
  confirm before doing it.
- **`docs/design-style-guide.md` names `public/brand/logo-wordmark.svg`, which does
  not exist.** The real pair is `logo.svg` (full lockup) + `logo-mark.svg`.
