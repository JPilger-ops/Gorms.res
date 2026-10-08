import { NextResponse, type NextRequest } from "next/server";

// Only URL context is propagated. Authorization stays in every server entrypoint.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  for (const name of Array.from(headers.keys())) {
    if (name.startsWith("x-gorms-")) headers.delete(name);
  }
  headers.set("x-gorms-request-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
