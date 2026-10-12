import type { Metadata } from "next";
import { ProjectsDashboard } from "@/components/projects/ProjectsDashboard";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Projects · Vidzart",
};

// Static page; the list itself is read from IndexedDB in the browser.
export default function ProjectsPage() {
  return (
    <>
      <SiteHeader current="projects" />
      <main className="flex-1">
        <ProjectsDashboard />
      </main>
      <SiteFooter />
    </>
  );
}
