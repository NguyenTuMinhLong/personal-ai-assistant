// hooks/useGuestMigration.tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

const GUEST_SESSION_KEY = "guest_session_id";
const PENDING_MIGRATION_KEY = "guest_pending_migration";

/**
 * Watches for Clerk sign-in events and migrates guest data to the authenticated user.
 *
 * Flow:
 * 1. Guest clicks "Sign Up" from GuestTrialPopup → anonymousId stored in localStorage
 * 2. Clerk handles sign-up → redirects to /documents
 * 3. This component detects the authenticated user and migrates the guest data
 */
export function GuestMigrationWrapper() {
  const { isSignedIn, isLoaded } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || ranRef.current) return;
    ranRef.current = true;

    const pendingMigration = localStorage.getItem(PENDING_MIGRATION_KEY);
    if (!pendingMigration) return;

    localStorage.removeItem(PENDING_MIGRATION_KEY);
    localStorage.removeItem(GUEST_SESSION_KEY);

    fetch("/api/webhooks/clerk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousId: pendingMigration }),
    }).catch((err) => {
      console.error("[guest-migration] Failed:", err);
    });
  }, [isLoaded, isSignedIn]);

  return null;
}
