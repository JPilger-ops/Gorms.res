# Reverse Proxy

## Scope

The production deployment sits behind an existing reverse proxy in a separate VLAN. TLS terminates
at the reverse proxy. The app container serves internal HTTP on port `6043`.

This documentation is for the later production server, not the current dev directory.

## Required Host Routing

Route both public and admin hosts to the same app endpoint:

```text
heidekönig.gorms.de              -> http://<APP_HOST_IP>:6043
xn--heideknig-57a.gorms.de       -> http://<APP_HOST_IP>:6043
login.gorms.de                  -> http://<APP_HOST_IP>:6043
```

The reverse proxy must preserve the original host through either `Host` or `X-Forwarded-Host`.
The app reads `X-Forwarded-Host` first and falls back to `Host`.

Forward these headers:

```text
Host:              original request host
X-Forwarded-Host:  original request host
X-Forwarded-Proto: https
X-Forwarded-For:   client IP chain
X-Real-IP:         client IP, if supported
```

## TLS

Configure certificates on the reverse proxy for:

- `heidekönig.gorms.de`
- `xn--heideknig-57a.gorms.de`
- `login.gorms.de`

The app container itself should not terminate TLS.

## Recommended Path Blocks

The app performs server-side host checks, but the reverse proxy should still block obvious wrong
paths.

Public host blocks for `heidekönig.gorms.de` and `xn--heideknig-57a.gorms.de`:

```text
/admin
/admin/*
/login
/login/*
/setup
/setup/*
```

Admin host blocks for `login.gorms.de`:

```text
/reservieren
/reservieren/*
```

The admin host may serve `/login`, `/setup`, `/admin`, `/branding/*` and framework assets. The
public host may serve `/`, `/reservieren`, `/branding/*` and framework assets.

## Firewall

For the VLAN/IP deployment model, allow only the reverse proxy to reach the app host on TCP `6043`.

Do not expose:

- PostgreSQL `5432`
- backup paths
- Docker socket
- upload or secret volumes

PostgreSQL remains inside the Docker internal network.

## Variant A: VLAN/IP Routing

This is the intended production model.

```text
reverse proxy VLAN/IP -> production app host IP:6043 -> app container
```

Recommended operational steps:

1. Deploy the app on the production Docker host.
2. Publish only app port `6043`.
3. Add Unifi/firewall rule allowing reverse-proxy IP to app-host TCP `6043`.
4. Deny other VLAN clients from app-host TCP `6043`.
5. Route all three hostnames to `http://<APP_HOST_IP>:6043`.
6. Ensure `X-Forwarded-Host` is not overwritten with the app host IP.

## Variant B: Shared Docker Network

This is optional. Use it only if the reverse proxy can join a Docker network on the same host.

The app can join an external proxy network while PostgreSQL remains internal-only:

```yaml
services:
  app:
    networks:
      - app
      - internal
      - proxy

networks:
  proxy:
    external: true
```

Do not attach `db` to the proxy network.

## Smoke Tests

From a machine that reaches the reverse proxy:

```bash
curl -I https://heidekönig.gorms.de
curl -I https://xn--heideknig-57a.gorms.de
curl -I https://login.gorms.de/login
```

Expected:

- public host shows the public reservation entry point
- admin host shows login or setup
- public host `/admin`, `/login`, `/setup` is blocked or returns app-level not found
- admin host `/reservieren` is blocked or returns app-level not found

Direct app-host test with explicit Host header:

```bash
curl -I -H "Host: login.gorms.de" http://<APP_HOST_IP>:6043/login
curl -I -H "Host: xn--heideknig-57a.gorms.de" http://<APP_HOST_IP>:6043/
```

Use this only from an allowed internal network.
