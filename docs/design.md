# Design

## Philosophy

The visual identity is rooted in a single scene: **an open grassy field under a clear blue sky on a sunny day**. The app is dark-themed (standard for a music player), but the darkness reads as depth and shadow within that scene rather than void. Backgrounds feel like earth and deep grass; accents feel like sky.

The rest of the Jaxsenville universe is fully 3D. Noise Emporium is mostly 2D — the gimmick is being a genuine music player competitor, not a 3D world. The one exception is the store section, which uses React Three Fiber to call back to Jaxsenville's identity (see below).

Accessibility is non-negotiable. Text must be readable at all sizes, interactive states must be visually distinct, and no information should be conveyed by color alone.

---

## Color Palette

All colors are defined as CSS custom properties in `src/index.css`. Nothing is hardcoded except the two button text colors that pair specifically with `--accent`.

| Variable | Value | Role |
|---|---|---|
| `--bg` | `#080d0a` | App background — near-black with a green cast |
| `--surface` | `#0d1610` | Cards, sheets, player bar |
| `--surface-raised` | `#142019` | Elevated surfaces within cards |
| `--border` | `#1c2e22` | Dividers, input outlines, row separators |
| `--text` | `#9ab5a3` | Body text — muted sage |
| `--text-dim` | `#4a6354` | Secondary labels, timestamps, metadata |
| `--text-bright` | `#dce9e3` | Titles, active text, high-emphasis labels |
| `--accent` | `#5ab5e0` | Clear sky blue — active states, highlights, play button |
| `--accent-dim` | `rgba(90,181,224,0.12)` | Accent tint for backgrounds (e.g. active loop pill) |
| `--accent-border` | `rgba(90,181,224,0.32)` | Accent tint for borders (e.g. focused inputs) |
| `--danger` | `#c04848` | Destructive actions, errors |

Buttons that use `--accent` as a background color use `#071018` (dark navy, near-black) as their text color — this is hardcoded in `.auth-submit`, `.btn-accent`, and `.np-btn--play` in `src/App.css`.

### What the palette maps to in the scene

| Scene element | Maps to |
|---|---|
| Deep grass shadow / earth | `--bg`, `--surface`, `--surface-raised` |
| Grass color, foliage | `--border`, `--text-dim` |
| Sage meadow haze | `--text` |
| Clear sky | `--accent` |
| Bright daylight | `--text-bright` |

---

## Typography

| Use | Font | Style |
|---|---|---|
| Wordmark, screen titles, song titles (Now Playing), playlist rename | Playfair Display | Italic, weight 400 |
| Everything else | DM Sans | weight 300–500 |

Both fonts are loaded from Google Fonts. Font size base is 16px. Body text runs 14–15px; labels and metadata run 12–13px.

---

## Custom Assets

The following assets don't exist yet but would strengthen the aesthetic. All should be drawn as **SVG** — scalable, small file size, can be inlined or imported as React components.

### 1. Grass blade divider
A horizontal strip of grass silhouettes — flat base, varying blade heights and curves, no stroke, filled with `#1c2e22` to `#2a4030`. Used to replace the flat `border-top` between the mini player and bottom nav, and optionally as a section separator elsewhere.

Draw: ~60–80px tall, full width. Blades should vary between ~20px and 55px in height. Keep it simple — 8 to 12 blades tiling across, repeatable via `background-repeat: repeat-x`.

### 2. Sun glow (Now Playing background)
A circle with short radiating lines — a simple sun mark. Used at very low opacity (8–12%) centered behind the album art on the Now Playing screen. Gives the blank-state screen warmth without competing with cover art.

Draw: ~200×200px, single color (white or `#5ab5e0`), no fill in the center circle. Rays can be short and rounded.

### 3. Horizon line
A gently undulating single-path line (top of a hill or field horizon) as a decorative section separator. Optionally replaces the flat `border-bottom: 1px solid var(--border)` on screen headers.

Draw: ~4–8px tall, full width, stroke only, color `#1c2e22`. Very subtle — just enough to suggest a landscape edge rather than a UI rule.

---

## The 3D Store Section

The music store (Part 1 of the public launch) is built in **React Three Fiber** and is intentionally visually distinct from the 2D app. This is a deliberate callback to Jaxsenville's other two fully-3D buildings.

**3D constraints (hard rules, not suggestions):**
- Low-polygon models only — no high-detail meshes
- Low-resolution textures throughout
- These constraints exist to keep frame rates healthy across mid-range hardware without a GPU

The 3D scene should still feel consistent with the sky/grass palette — think: warm daylight, open air, natural materials. The 2D and 3D halves of the app should feel like they belong to the same world even though they're built differently.
