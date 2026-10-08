import type { Metadata } from "next";
import { getAdminVenue } from "@/src/server/guards";

export async function generateMetadata(): Promise<Metadata> {
  const venue = await getAdminVenue();
  const icon = `/branding/favicon?venue=${venue.id}`;
  return { title: venue.name, icons: { icon: [{ url: icon }], apple: [{ url: icon }] } };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
