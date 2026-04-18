import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { deleteUserDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ documentId: string }>;
};

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;

  if (!documentId) {
    return NextResponse.json(
      { error: "Document id is required." },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteUserDocument(user.id, documentId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete document.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
