# DSIMS – UI/UX Design System Specification
## Project PS000214: Dead Stock Inventory Management System
**District Development Office / District Panchayat – Gir Somnath, Gujarat**  
**Hackathon:** Seva First Innovation Challenge (SFIC) 2026–27  
**Version:** 2.0 (Premium Enterprise Glassmorphism + Morphing Navigation + Dual-Theme)

---

## 1. Visual Identity & Color Tokens

The visual identity is designed specifically for high-trust government enterprise inventory operations. It avoids generic tech templates and oversaturated purple/neon trends in favor of **Deep Forest Teal**, **Dark Spruce**, and **Soft Mint**.

### 1.1 Color Tokens Matrix

| Semantic Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--bg-app` | `#F2F7F5` (Warm Mint White) | `#101C1A` (Abyssal Spruce) | Main page canvas background |
| `--bg-surface` | `#FFFFFF` (Pure White) | `#192A26` (Deep Emerald Surface) | Solid surface / base card background |
| `--primary` | `#087B61` (Deep Forest Teal) | `#55C9A3` (Luminous Mint) | Primary buttons, active elements, brand badges |
| `--primary-dark` | `#075443` (Dark Emerald) | `#163C32` (Spruce Pine) | Hover states, sidebar accents |
| `--accent` | `#BCEBDD` (Soft Sage Mint) | `#8AE4C1` (Mint Glow) | Focus rings, subtle indicators, highlights |
| `--text-primary` | `#172B28` (Pine Charcoal) | `#ECF6F1` (Pale Mint White) | Primary typography, high-contrast headings |
| `--text-secondary`| `#667A75` (Neutral Sage) | `#A4B8AF` (Muted Sage Grey) | Supporting labels, descriptions, metadata |
| `--border-color` | `rgba(26, 77, 65, 0.12)` | `rgba(210, 245, 228, 0.12)`| Delicate translucent glass divider lines |
| `--sidebar-bg` | `#075443` (Deep Teal) | `#091210` (Dark Spruce Black) | Signature vertical navigation bar |

---

## 2. Signature Sidebar – Morphing Active Navigation

### 2.1 The Geometric Cutout Silhouette
The active navigation shape morphs the sidebar boundary to seamlessly merge with the main content canvas (`--bg-app`). 

- **Cutout Mechanics:** The active link takes the exact background color of the canvas (`var(--bg-app)`), negative right margin (`-0.75rem`), and rounded corners on the left (`24px`).
- **Concave Curves (Inverted Radius):** Pseudo-elements `::before` and `::after` with inverted border-radius and `box-shadow: 6px [±6px] 0 6px var(--bg-app)` form smooth, organic concave curves above and below the active selection.
- **Zero Repaint Overhead:** Uses native GPU-accelerated CSS rendering and shadow composition without expensive canvas repainting or layout thrashing.

### 2.2 Collapsed Icon-Only Mode
- **Width Transition:** Smoothly collapses from `w-72` (288px) to `w-20` (80px) via `transition-all duration-300`.
- **Floating Tooltips:** On collapsed state, hovering over any icon reveals a floating tooltip badge anchored to the right.
- **Toggle Control:** Accessible chevron button at the bottom of the sidebar.

### 2.3 Mobile Off-Canvas Drawer
- **Breakpoint:** Automatically shifts to an off-canvas drawer on viewports `< 768px` (iPad & Mobile).
- **Backdrop:** Semi-transparent blurred scrim (`bg-forest-950/70 backdrop-blur-sm`).
- **Dismissal:** Accessible Escape key listener, backdrop click, or close button.
- **Scroll Lock:** Automatically freezes `document.body` scroll while drawer is mounted to prevent background scroll interference.

---

## 3. Global Glassmorphism Surface Standards

Glassmorphism is deployed with strict enterprise readability constraints. Complex tables, data inputs, and dense numerical registers remain opaque and readable, with glass reserved for structural elevations:

### 3.1 Surface Elevation Hierarchy

1. **Level 1 (KPI & Dashboard Cards):**
   - Classes: `bg-white/80 dark:bg-forest-800/70 backdrop-blur-md border border-forest-500/10 dark:border-forest-300/10 shadow-glass-sm`
   - Purpose: Main KPI cards, summary widgets, data list wrappers.
2. **Level 2 (Interactive Panels & Floating Toolbars):**
   - Classes: `bg-white/90 dark:bg-forest-800/85 backdrop-blur-lg border border-forest-500/15 dark:border-forest-300/15 shadow-glass-md`
   - Purpose: Filter bars, view switchers, dropdown menus, quick action grids.
3. **Level 3 (Modals & Overlays):**
   - Classes: `bg-white/95 dark:bg-forest-900/95 backdrop-blur-xl border border-forest-500/20 dark:border-forest-300/20 shadow-glass-lg`
   - Purpose: Dialog boxes, confirmation modals, Excel import wizard.

---

## 4. Cursor Interactions & Motion System

### 4.1 Interactive Lighting & Cursor Following
- KPI cards and interactive `GlassCard` components track mouse coordinates (`clientX`, `clientY`) relative to the card's bounding box.
- Renders an ultra-subtle radial gradient (`radial-gradient(400px circle at Xpx Ypx, rgba(85,201,163,0.12), transparent 80%)`).
- Smoothly fades out on `mouseleave` with `transition-opacity duration-300`.

### 4.2 Selective 3D Tilt
- Applied **strictly** to top-level KPI cards (never to tables, forms, or data grids).
- Calculates gentle angular tilt (maximum $\pm 3.5^{\circ}$) relative to center point.
- **Safety Constraints:** Completely disabled on touch devices (`'ontouchstart' in window`) and when `prefers-reduced-motion` is detected.

### 4.3 Motion Architecture
- **Animation Framework:** Lightweight `framer-motion` (v11) for fluid enter/exit transitions and spring physics.
- **Timing Standards:**
  - Micro-interactions (hover, active): 150ms–200ms ease.
  - Card & View entrances: 250ms–350ms ease-out.
  - Sidebar & drawer motions: 250ms–400ms spring with damping 25.
  - Modal dialogues: 200ms with scale factor 0.96 to 1.0.

---

## 5. Dual-Theme Engine (Light & Dark)

- **Persistence:** Saved in `localStorage` under key `dsims_theme`.
- **Zero-FOUC Guarantee:** Inline synchronous script embedded in `<head>` in `index.html` resolves theme state and injects `.dark` class before DOM render.
- **System Preference Detection:** Synchronizes with OS `prefers-color-scheme: dark` when no explicit manual override exists.
- **Accessible Switcher:** Theme toggle button embedded in sidebar footer (accessible in both expanded and collapsed modes) and on the authentication login screen.

---

## 6. Table View vs. Card View Architecture

Data-heavy registers (Asset Register, Stock Receipts, Issues, Returns, Transfers, Ledger) support one-click switching:
- **Shared State Pipeline:** Switching between Table and Card view preserves active search queries, dropdown filters, pagination, and sorting without refetching or duplicating datasets.
- **Persistence:** User's preferred presentation mode is remembered in `localStorage` (`dsims_inventory_view`, `dsims_receipts_view`, etc.).
- **Responsive Layout:**
  - Table: Horizontal scrollbar with fixed column widths, monospace serial numbers, and action menus.
  - Card: 1-col (mobile), 2-col (tablet), 3-col (desktop) responsive glass grid highlighting key metadata badges.

