import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listMessages } from "@/lib/sessions";
import { getChatSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session id is required." },
      { status: 400 }
    );
  }

  try {
    const [session, messages] = await Promise.all([
      getChatSession(user.id, sessionId),
      listMessages(sessionId),
    ]);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    const sessionTitle = session.title ?? "Untitled Chat";
    const documentName = session.document_name ?? "Document";
    const now = new Date().toISOString().split("T")[0];

    const lines: string[] = [];
    lines.push(`# ${sessionTitle}`);
    lines.push("");
    lines.push(`> **Document:** ${documentName}`);
    lines.push(`> **Date:** ${now}`);
    lines.push(`> **Exported from:** Personal AI Assistant`);
    lines.push("");
    lines.push("---");
    lines.push("");

    for (const msg of messages) {
      if (msg.role === "user") {
        lines.push(`## You`);
        lines.push("");
        lines.push(msg.content);
        lines.push("");
      } else {
        lines.push(`## AI Assistant`);
        lines.push("");
        lines.push(msg.content);
        lines.push("");

        if (msg.citations && msg.citations.length > 0) {
          lines.push("**Sources:**");
          for (const citation of msg.citations) {
            const filename = (citation as Record<string, unknown>).filename ?? "document";
            const chunkIdx = (citation as Record<string, unknown>).chunkIndex ?? 0;
            lines.push(`- [${filename}](#) — chunk ${Number(chunkIdx) + 1}`);
          }
          lines.push("");
        }
      }

      if (msg.imageUrls && msg.imageUrls.length > 0) {
        lines.push(`**Attached images:** ${msg.imageUrls.length}`);
        lines.push("");
      }

      if (msg.chatFiles && msg.chatFiles.length > 0) {
        lines.push("**Attached files:**");
        for (const file of msg.chatFiles) {
          lines.push(`- ${file.filename} (${formatFileSize(file.fileSize)})`);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }

    const markdown = lines.join("\n");
    const filename = `${sessionTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${now}.md`;

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not export chat.";
    console.error("[export]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
