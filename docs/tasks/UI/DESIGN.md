# Design System Document: The Editorial Workspace

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Atheneum"**
This design system moves beyond the utility of a standard text editor to create a high-end, editorial environment. It treats digital documents with the same reverence as a physical gallery or a premium print publication. While inspired by the efficiency of Lark/Feishu, our goal is to eliminate the "clutter of productivity" in favor of "the clarity of thought."

We break the "template" look by rejecting the rigid, boxy constraints of traditional SaaS. Instead of using lines to define space, we use **Tonal Architecture** and **intentional whitespace**. The system prioritizes the content, using sophisticated, layered surfaces to create a sense of focus, calm, and professional authority.

---

## 2. Colors & Surface Architecture
The palette is rooted in a crisp, high-contrast base, punctuated by a deep, authoritative blue. It is designed to feel expansive and clinical, yet sophisticated.

### Tonal Hierarchy
- **Primary Hub (`#0050d6`):** Used for critical focus points and brand signatures.
- **Surface Strategy:** We move away from flat white. Use `surface_container_lowest` (#ffffff) for the active writing canvas to simulate a fresh sheet of paper, set against a `surface` (#f8f9ff) background to provide a soft "peripheral" frame.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section off major UI areas. 
- Boundaries must be defined by background shifts. For example, a sidebar should use `surface_container_low` (#f1f3fc) to naturally recede from the primary canvas (`surface_container_lowest`).
- High-contrast lines create visual noise; tonal shifts create focus.

### The "Glass & Gradient" Rule
To elevate the experience, floating toolbars and sticky headers should utilize **Glassmorphism**.
- **Implementation:** Use `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur. 
- **Signature Polish:** For primary CTA buttons or "Hero" states, apply a subtle linear gradient from `primary` (#0050d6) to `primary_container` (#2a6af9) at a 135° angle. This adds a "jewel-like" depth that flat hex codes cannot achieve.

---

## 3. Typography: Editorial Authority
The type system pairs **Plus Jakarta Sans** for high-level structure and **Inter** for sustained reading.

- **Display & Headline (Plus Jakarta Sans):** These levels use tight letter-spacing (-0.02em) to create a bold, "ink-on-paper" editorial feel. 
    - *Display-LG (3.5rem)*: Used for document titles to establish an immediate sense of scale.
- **Body & Labels (Inter):** Optimized for the "long-form" experience. 
    - *Body-LG (1rem)*: Our standard for document text. It uses an increased line-height (1.6) to prevent eye fatigue during editing.
- **Hierarchy of Intent:** Large headlines denote the "Theme," while the Title-MD (1.125rem) serves as the "Instruction," guiding the user through the interface without shouting.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows and borders are replaced by a "Layering Principle" that mimics physical sheets of paper.

- **The Stacking Principle:** To create hierarchy, stack tiers. Place a `surface_container_highest` element on a `surface_container_low` background to signify a high-priority interaction (like a dropdown menu).
- **Ambient Shadows:** When a true "lift" is required (e.g., a modal), use an ultra-diffused shadow:
    - *Shadow:* `0 12px 32px -4px rgba(24, 28, 34, 0.06)` (using `on_surface` for the tint). It should feel like a soft glow of light, not a dark smudge.
- **The Ghost Border:** If a container needs containment for accessibility (like an input field), use `outline_variant` at **20% opacity**. This creates a "suggestion" of a boundary rather than a hard wall.

---

## 5. Components: Functional Elegance

### Buttons
- **Primary:** Gradient-filled (Primary to Primary-Container), `DEFAULT` (0.5rem) roundedness.
- **Secondary:** `surface_container_high` background with `on_surface` text. No border.
- **States:** On hover, primary buttons should scale slightly (1.02x) rather than just changing color, providing a premium, tactile response.

### The Icon-Centric Toolbar
The toolbar is the "instrument panel."
- **Styling:** Floating, `xl` (1.5rem) roundedness, Glassmorphic background.
- **Interaction:** Icons use `on_surface_variant`. On hover, a circular `surface_container_highest` background appears. Avoid "boxed" icons; let them breathe on the glass surface.

### Input Fields
- **Design:** Forgo the 4-sided box. Use a `surface_container_low` fill with a `Ghost Border` at the bottom only to maintain an "open" editorial feel.
- **Focus State:** Transitions to a 2px `primary` bottom border with a subtle `primary_fixed` glow.

### Lists & Cards
- **The Divider Ban:** Never use horizontal lines to separate list items. 
- **The Spacing Solution:** Use `2` (0.5rem) or `3` (1rem) spacing to create "islands" of content. Separation is achieved through the rhythmic application of vertical white space.

---

## 6. Do’s and Don’ts

### Do
- **Do use "Nested Depth":** Put `surface_container_lowest` cards inside a `surface_container_low` sidebar.
- **Do prioritize "Breathing Room":** Use the `16` (5.5rem) and `20` (7rem) spacing tokens for page margins to give the document a "premium gallery" feel.
- **Do use Asymmetry:** In the dashboard layout, allow the document canvas to be centered with an asymmetrical sidebar to break the "standard app" grid.

### Don't
- **Don't use 100% Black:** Never use `#000000`. Use `on_surface` (#181c22) to keep the contrast high but the "vibe" sophisticated.
- **Don't use "Heavy" Borders:** Avoid `outline` (#737687) for anything other than high-contrast accessibility needs.
- **Don't Over-Shadow:** If three elements are on screen, only one should have an ambient shadow. Let the others rely on tonal shifts.