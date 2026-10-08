export function adminUrl(path: string, venueId: string) {
  const url = new URL(path, "http://admin.invalid");
  if (
    url.origin !== "http://admin.invalid" ||
    (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/"))
  )
    throw new Error("Invalid admin path.");
  url.searchParams.set("venue", venueId);
  return `${url.pathname}${url.search}`;
}

export function adminHome(venue: { id: string; availabilityStrategy: string }) {
  return adminUrl(
    venue.availabilityStrategy === "TABLES" ? "/admin/table-plan" : "/admin",
    venue.id,
  );
}
