---
name: GymRat
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393d'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b1f'
  surface-container: '#1e1f23'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343539'
  on-surface: '#e3e2e7'
  on-surface-variant: '#c5c9ac'
  inverse-surface: '#e3e2e7'
  inverse-on-surface: '#2f3034'
  outline: '#8f9378'
  outline-variant: '#444932'
  surface-tint: '#b0d500'
  primary: '#ffffff'
  on-primary: '#2a3400'
  primary-container: '#caf300'
  on-primary-container: '#596c00'
  inverse-primary: '#536600'
  secondary: '#c8c6c5'
  on-secondary: '#303030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#ffffff'
  on-tertiary: '#303030'
  tertiary-container: '#e4e2e1'
  on-tertiary-container: '#656464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#caf300'
  primary-fixed-dim: '#b0d500'
  on-primary-fixed: '#171e00'
  on-primary-fixed-variant: '#3e4c00'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1b1b1c'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474746'
  background: '#121317'
  on-background: '#e3e2e7'
  surface-variant: '#343539'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-margin-mobile: 16px
  container-margin-desktop: 32px
  gutter: 16px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 40px
---

## Brand & Style

The design system is engineered for high-performance fitness environments, characterized by a **Technical Minimalism** aesthetic mixed with **High-Contrast Bold** accents. It mirrors the feeling of premium athletic hardware: durable, precise, and uncompromising.

The target audience consists of dedicated athletes and fitness enthusiasts who require immediate data legibility under physical strain. The UI evokes a sense of "Flow State"—removing friction through clear hierarchy while providing a surge of energy through high-intensity color hits. The style utilizes deep layering, sharp typography, and "industrial-grade" interactive elements to create an environment that feels both elite and motivating.

## Colors

The palette is rooted in a "Carbon-Fiber" foundation. The primary background is a deep **#121212**, providing maximum contrast for the **Electric Lime (#D4FF00)** primary color.

- **Primary (Electric Lime):** Reserved for high-priority actions, active states, and progress indicators. It is the "ignition" color of the design system.
- **Surface Tiers:** Use incremental shifts from #1C1C1C to #2A2A2A to define card depth and container nesting.
- **Functional Colors:** Success and Error tokens are high-chroma variants to ensure visibility against dark backgrounds during intense activity.
- **Muted Elements:** Secondary text and non-interactive borders use a medium grey to recede, ensuring the user's focus remains on performance data.

## Typography

This design system utilizes a dual-font strategy to balance athletic branding with technical precision.

1. **Inter:** Used for all prose, headings, and UI labels. Headings should utilize tight tracking and heavy weights (Bold/ExtraBold) to convey strength.
2. **JetBrains Mono:** Used exclusively for numerical data, timers, and performance metrics. The monospaced nature prevents "jumping" layouts during active counting and provides a high-tech, diagnostic feel.

**Hierarchy Rules:**
- Use `display-lg` for primary workout metrics (e.g., Weight, Reps).
- Use `label-caps` for small metadata descriptors above data points.
- Maintain high contrast by using White for all primary text and Muted Grey only for labels or disabled states.

## Layout & Spacing

The layout philosophy follows a **Strict Fluid Grid** based on an 8px square rhythm. This ensures that touch targets are consistently large and mathematically aligned.

- **Mobile:** A 4-column grid with 16px margins. Vertical stacks should be generous (24px+) to prevent accidental taps during motion.
- **Desktop/Tablet:** A 12-column grid. Data dashboards should use a masonry-style card layout to allow for varied content density.
- **Safe Zones:** High-priority workout controls (Start/Stop/Lap) must maintain a minimum 64px vertical clearance from other interactive elements.

## Elevation & Depth

To maintain a focused and durable aesthetic, the design system avoids traditional soft shadows in favor of **Tonal Layering** and **Low-Contrast Outlines**.

- **Depth:** Surfaces are defined by their hex value. The further "forward" an object is, the lighter its grey background.
- **Outlines:** Cards and containers utilize a 1px solid border (#2A2A2A). Active cards or focused inputs replace this with a 1px Electric Lime border.
- **Overlays:** Modals and bottom sheets use a 40% background blur (backdrop-filter) on a semi-transparent slate base to maintain context while isolating the task.

## Shapes

The shape language is **Soft (Level 1)**, leaning toward a functional, "milled" appearance rather than a playful rounded one.

- **Standard Elements:** 4px radius for buttons, inputs, and small chips.
- **Large Containers:** 8px radius for primary workout cards and dashboard modules.
- **Interactive Logic:** Toggles and progress bars utilize a fully rounded (pill) cap to distinguish them from structural layout elements.

## Components

### Buttons
- **Primary:** Electric Lime background with black text. 800 weight. High-impact height (minimum 56px for workout screens).
- **Secondary:** Ghost style with 1px grey border and white text.
- **Destructive:** Solid Red background for "End Workout" actions to prevent errors.

### Cards
- Background: #1C1C1C. 1px solid border: #2A2A2A.
- Content should be padded by 20px internally. Headings inside cards should use `label-caps` for categorization.

### Inputs & Sliders
- **Inputs:** Darker background than the card surface. Focus state triggers the Electric Lime border.
- **Sliders:** The track should be a dark grey, with the active portion and handle in Electric Lime. Handles should be large (24px+) for easy manipulation with sweaty hands.

### Lists
- Use "Divided Rows" with 1px separators. Each row should have a minimum height of 64px.
- Chevron indicators should be used for drill-down items, utilizing the Muted Grey color.

### Charts & Analytics
- Lines should be 2px thick in Electric Lime.
- Area charts should use a gradient fill from Electric Lime (20% opacity) to Transparent.
- Grid lines in charts must be subtle (#2A2A2A) to not compete with the data.
