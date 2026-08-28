"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Supabase automatically picks up the session from the URL hash
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.push("/");
        return;
      }
      // Check if this user already has a profile
      try {
        const res = await fetch(`${API_BASE}/profile/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const p = await res.json();
          if (p?.username) {
            router.push("/"); // Has profile — go home
          } else {
            router.push("/profile/setup"); // No profile — go set one up
          }
        } else {
          router.push("/profile/setup");
        }
      } catch {
        router.push("/profile/setup");
      }
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <img src="/logo-mark.png" alt="Cruiser Meets" style={{ height: 32, width: "auto", margin: "0 auto 16px" }} />
        <div style={{ color: "#bbb", fontSize: 14 }}>Signing you in...</div>
      </div>
    </div>
  );
}
