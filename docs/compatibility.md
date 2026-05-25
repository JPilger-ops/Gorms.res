# Compatibility

## Supported Browsers

Target browsers for version 1:

- iOS Safari
- Android Chrome
- Desktop Chrome
- Desktop Firefox
- Desktop Edge
- Desktop Safari

The app is rendered with Next.js App Router and uses native HTML form controls for the critical
reservation, login, setup, and admin workflows.

## CSS Compatibility Strategy

- `backdrop-filter` is guarded with `@supports`; browsers without support receive solid panels.
- `color-mix()` is guarded with `@supports`; browsers without support receive simpler fallback
  colors.
- The layout avoids hover-only behavior. Hover styles only improve feedback for pointer devices.
- `prefers-reduced-motion` disables animations and transitions for motion-sensitive users.
- `prefers-color-scheme` provides a dark color palette.
- `forced-colors` reduces decorative effects and keeps borders visible in high-contrast modes.
- Layout containers use `min-width: 0`, wrapping, and responsive grids to avoid horizontal overflow.

## Device Checks

Before production release, manually test:

1. Public reservation page at 320 px, 390 px, 768 px, 1024 px, and desktop widths.
2. Date, time, number, phone, email, checkbox, textarea, and file upload controls on iOS Safari.
3. Admin navigation on tablet/mobile, including horizontal nav scrolling.
4. Login and setup pages on small mobile screens.
5. Branding upload controls with long filenames.
6. Long e-mail addresses, URLs, and e-mail subject templates in admin settings.
7. Reduced-motion and dark-mode rendering.

## Operational Notes

The app runs internally over HTTP behind the existing reverse proxy. TLS behavior, HTTP/2, HSTS,
compression, and public browser cache policy are controlled at the reverse proxy layer unless
explicitly configured in the app.
