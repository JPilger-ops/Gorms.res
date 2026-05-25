# Branding

## Editable Branding

Admins can manage:

- logo
- favicon
- primary/accent color

The public reservation page and admin shell use the configured logo and accent color.

## Upload Storage

Branding files are stored in the upload volume:

```text
/app/uploads
```

Docker volume:

```text
heidekoenig_uploads
```

## Upload Safety

Allowed image types:

- PNG
- JPEG
- WebP
- ICO for favicon

SVG is intentionally not accepted because unsanitized SVG can contain active content. File names are
generated server-side and client-provided paths are not trusted.

## Favicon

The root layout points favicon links to:

```text
/branding/favicon
```

That route serves the configured favicon when available and falls back to default behavior when no
custom favicon has been uploaded.
