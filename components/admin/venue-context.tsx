"use client";

import { createContext, useContext } from "react";

const VenueContext = createContext<string | null>(null);

export function AdminVenueProvider({
  venueId,
  children,
}: {
  venueId: string;
  children: React.ReactNode;
}) {
  return <VenueContext.Provider value={venueId}>{children}</VenueContext.Provider>;
}

export function VenueField() {
  const venueId = useContext(VenueContext);
  if (!venueId) throw new Error("Admin venue context is missing.");
  return <input name="venueId" type="hidden" value={venueId} />;
}
