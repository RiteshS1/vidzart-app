import type { Metadata } from "next";
import { EditorLoader } from "@/components/editor/EditorLoader";

export const metadata: Metadata = {
  title: "Editor",
  // An app shell with nothing to read until a project is open.
  robots: { index: false, follow: true },
  alternates: { canonical: "/editor" },
};

export default function EditorPage() {
  return <EditorLoader />;
}
