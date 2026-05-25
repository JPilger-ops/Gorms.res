# Accessibility

## Goals

The reservation app is built for keyboard, touch, mouse, and screen-reader use from the first
release. The public reservation flow and protected admin screens use semantic HTML and server-side
validation so the core workflows do not depend on fragile client-only behavior.

## Implemented Baseline

- Document language is set to German with `lang="de"`.
- Every page exposes a single main content target with `id="main-content"`.
- A skip link lets keyboard users jump directly to the page content.
- Forms use visible labels, native form controls, and server-side validation messages.
- Form result messages use `role="status"` for successful updates and `role="alert"` for errors.
- Buttons expose busy state with `aria-busy` while server actions are pending.
- Keyboard focus is visible through `:focus-visible`.
- Motion respects `prefers-reduced-motion`.
- Color mode respects `prefers-color-scheme`.
- High-contrast operating-system modes get a forced-colors fallback for panels and controls.
- Decorative status dots are hidden from assistive technology where visible text already explains
  the state.

## Design Constraints

- Liquid-glass panels must keep readable foreground/background contrast.
- Blur and transparency are progressive enhancement only; solid panel fallbacks are defined.
- Touch targets for primary workflows should remain at least 48 px high.
- Hover styles are enhancements only; all controls must remain usable without hover.

## Manual Check List

Run these checks before production changes:

1. Navigate public reservation, login, setup, and admin pages with keyboard only.
2. Confirm the skip link appears on first Tab and moves focus to the main content.
3. Submit invalid forms and confirm errors are announced by a screen reader.
4. Submit successful admin forms and confirm success messages are announced.
5. Check zoom at 200% and mobile widths around 320 px.
6. Check light mode, dark mode, and reduced-motion mode.
7. Check high-contrast mode where available.

## Known Limits

Automated accessibility tooling is not installed yet. The current verification is lint/type/build
based plus code inspection. A later test step can add Playwright and axe checks if we want automated
browser-level coverage.
