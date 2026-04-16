import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { DocumentsManager } from "@/components/documents/DocumentsManager";
import { listUserDocuments } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const documents = await listUserDocuments(user.id);

  return <DocumentsManager initialDocuments={documents} />;
}
