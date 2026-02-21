"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function AuthModal({ onClose, onAuth, initialTab = "signin" }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const inp = {
    width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8,
    padding: "11px 14px", fontSize: 14, outline: "none",
    color: "#1a1a1a", background: "#FAFAF9", marginBottom: 12,
    fontFamily: "inherit",
  };
  const lbl = { fontSize: 12, color: "#999", display: "block", marginBottom: 6 };

  // After any successful auth, check if profile exists — redirect to setup if not
  async function handlePostAuth(user, accessToken) {
    try {
      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const p = await res.json();
        if (p?.username) {
          // Has profile — continue normally
          onAuth(user);
          onClose();
        } else {
          // No profile — redirect to setup
          onClose();
          router.push("/profile/setup");
        }
      } else {
        // Error fetching — send to setup to be safe
        onClose();
        router.push("/profile/setup");
      }
    } catch {
      onClose();
      router.push("/profile/setup");
    }
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user && !data.user.identities?.length === 0) {
          // Email confirmation required — show message
          setSuccess("Check your email to confirm your account, then sign in!");
        } else if (data?.session) {
          // Auto-confirmed (e.g. email confirmations disabled in Supabase)
          await handlePostAuth(data.user, data.session.access_token);
        } else {
          setSuccess("Check your email to confirm your account, then sign in!");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await handlePostAuth(data.user, data.session.access_token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    // For Google OAuth, the redirect handles post-auth — we use the callback URL
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 16, padding: 32,
          width: "100%", maxWidth: 400,
          boxShadow: "0 8px 48px rgba(0,0,0,0.15)",
          fontFamily: "'DM Sans', -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Cruiser</span>
          </div>
          {/* Tabs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#F5F5F3", borderRadius: 8, padding: 3 }}>
            {["signin", "signup"].map((t) => (
              <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
                style={{
                  background: tab === t ? "white" : "transparent",
                  border: "none", borderRadius: 6, padding: "8px 0",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  color: tab === t ? "#1a1a1a" : "#888",
                  boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  fontFamily: "inherit",
                }}>
                {t === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
        </div>

        {/* Google */}
        <button onClick={handleGoogle}
          style={{
            width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8,
            padding: "11px 14px", fontSize: 14, background: "white",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 10, marginBottom: 16, fontWeight: 500,
            fontFamily: "inherit",
          }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.6-4.9 7.3v6h7.9c4.6-4.3 7.3-10.6 7.3-17.4z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.7v6.2C6.7 42.8 14.8 48 24 48z"/>
            <path fill="#FBBC05" d="M10.8 28.8c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-6.2H2.7C1 17.1 0 20.4 0 24s1 6.9 2.7 9.9l8.1-5.1z"/>
            <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.5 30.4 0 24 0 14.8 0 6.7 5.2 2.7 14.1l8.1 6.2C12.7 14.6 17.9 9.5 24 9.5z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "#E8E8E4" }} />
          <span style={{ fontSize: 12, color: "#bbb" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "#E8E8E4" }} />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth}>
          <label style={lbl}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" style={inp} />
          <label style={lbl}>Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" style={{ ...inp, marginBottom: 16 }} />

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 12 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 12 }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", background: "#1a1a1a", color: "white", border: "none",
              borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
              fontFamily: "inherit",
            }}>
            {loading ? "..." : tab === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {tab === "signup" && (
          <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 16, marginBottom: 0 }}>
            By signing up you agree to our terms. Your account is subject to community guidelines — repeated violations will result in a ban.
          </p>
        )}
      </div>
    </div>
  );
}
