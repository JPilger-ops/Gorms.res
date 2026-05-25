import { getBrandingAsset } from "@/src/server/branding";

export const dynamic = "force-dynamic";

function fallbackFavicon() {
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#234235"/>
      <path d="M18 44V20h7v9h14v-9h7v24h-7v-9H25v9z" fill="#fbfff9"/>
    </svg>`,
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    },
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;

  if (asset !== "favicon" && asset !== "logo") {
    return new Response("Not found", { status: 404 });
  }

  const brandingAsset = await getBrandingAsset(asset);

  if (!brandingAsset) {
    return asset === "favicon" ? fallbackFavicon() : new Response("Not found", { status: 404 });
  }

  return new Response(brandingAsset.bytes, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": brandingAsset.mimeType,
    },
  });
}
