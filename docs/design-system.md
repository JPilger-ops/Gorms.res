# Design System

## Direction

The interface uses a restrained Apple-like Liquid-Glass direction: soft translucent panels, clear
typography, large tap targets, calm shadows and generous spacing. Effects must never reduce
readability or accessibility.

## Tokens

Global CSS variables in `app/globals.css` define:

- background and foreground colors
- muted text
- surface and glass colors
- border colors
- primary/accent colors
- success, warning and danger states
- focus color
- panel/control radii
- soft shadows

Branding can override the primary accent color from the admin panel.

## Components

Common patterns:

- `.app-shell`: page background and outer spacing
- `.page-frame`: centered content width
- `.glass-panel`: high-level framed panel
- `.glass-control`: inputs and compact status capsules
- `.primary-action`: main submit/command button
- `.secondary-action`: secondary command button
- `.eyebrow`: compact section label

## Accessibility Rules

- Keep visible labels for all form fields.
- Keep focus states visible.
- Avoid hover-only interactions.
- Respect reduced motion.
- Maintain solid background fallbacks for glass effects.
- Use native HTML controls where possible.

## Responsive Rules

Layouts are mobile-first. Desktop grids use `minmax(0, 1fr)` and containers use `min-width: 0` to
avoid overflow with long e-mails, URLs and templates.
