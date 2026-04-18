// hooks/useChatSessions.ts
"use client";

import { useEffect, useState } from "react";
import type { ChatSession } from "@/types";

export function useChatSessions(documentId?: string) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchSessions() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (documentId) params.set("documentId", documentId);

        const res = await fetch(`/api/sessions?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { sessions: ChatSession[] };
        setSessions(data.sessions);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [documentId]);

  return { sessions, loading };
}