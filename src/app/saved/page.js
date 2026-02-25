"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function formatDatePretty(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

export default function SavedMeetsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push("/");
        return;
      }
      setUser(session.user);
      loadSavedMeets(session.access_token);
    });
  }, []);

  async function loadSavedMeets(token) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/favorites/meets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setMeets(data);
      setFavoriteIds(new Set(data.map(m => m.id)));
    } catch (e) {
      console.error("Error loading saved meets:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsave(meetId) {
    setTogglingId(meetId);
    // Optimistic remove
    setMeets(prev => prev.filter(m => m.id !== meetId));
    setFavoriteIds(prev => { const s = new Set(prev); s.delete(meetId); return s; });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${API_BASE}/favorites/${meetId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
    } catch (e) {
      console.error("Unsave error:", e);
      // Reload to revert
      const { data: { session } } = await supabase.auth.getSession();
      if (session) loadSavedMeets(session.access_token);
    } finally {
      setTogglingId(null);
    }
  }

  const gradients = {
    "Cars & Coffee": "linear-gradient(135deg, #2c1810 0%, #6b3a2a 50%, #c4763a 100%)",
    "Cruise":        "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    "Night Meet":    "linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)",
    "Show":          "linear-gradient(135deg, #1a1a1a 0%, #3d2b1f 50%, #7c4a2d 100%)",
    "Track Day":     "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #555 100%)",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; } body { margin: 0; }`}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <button onClick={() => router.push("/")}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => router.push("/")}
              style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "#555", cursor: "pointer" }}>
              ← All Meets
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
              style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "#555", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 6px", color: "#1a1a1a" }}>
            Saved Meets
          </h1>
          <p style={{ fontSize: 14, color: "#888", margin: 0 }}>
            {loading ? "Loading..." : meets.length === 0 ? "No saved meets yet" : `${meets.length} saved meet${meets.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, overflow: "hidden", height: 280, opacity: 0.5 }}>
                <div style={{ height: 160, background: "#F0EFEB" }} />
                <div style={{ padding: 20 }}>
                  <div style={{ height: 12, background: "#F0EFEB", borderRadius: 4, marginBottom: 8, width: "60%" }} />
                  <div style={{ height: 16, background: "#F0EFEB", borderRadius: 4, width: "80%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && meets.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ marginBottom: 16, color: "#ddd" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: "#1a1a1a" }}>No saved meets yet</div>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Heart a meet from the events page or meet details to save it here.</div>
            <button onClick={() => router.push("/")}
              style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "11px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              Browse Meets
            </button>
          </div>
        )}

        {/* Meets grid */}
        {!loading && meets.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {meets.map(m => {
              const fallback = gradients[m.event_type] || "linear-gradient(135deg, #1a1a1a, #444)";
              return (
                <article key={m.id} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, overflow: "hidden", position: "relative", transition: "all 0.18s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#d0d0cc"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.07)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#E8E8E4"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>

                  {/* Unsave button */}
                  <button
                    onClick={() => handleUnsave(m.id)}
                    disabled={togglingId === m.id}
                    title="Remove from saved"
                    style={{
                      position: "absolute", top: 10, right: 10, zIndex: 10,
                      background: "rgba(255,255,255,0.92)", border: "none", borderRadius: "50%",
                      width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: togglingId === m.id ? "not-allowed" : "pointer",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                      opacity: togglingId === m.id ? 0.5 : 1, color: "#E11D48",
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#E11D48" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  </button>

                  {/* Banner */}
                  <div style={{
                    height: 160,
                    backgroundImage: m.photo_url ? `url(${m.photo_url})` : fallback,
                    backgroundSize: "cover", backgroundPosition: "center",
                    cursor: "pointer",
                  }} onClick={() => router.push(`/meets/${m.id}`)} />

                  <div style={{ padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, background: "#F5F5F3", color: "#777", padding: "4px 10px", borderRadius: 100 }}>
                        {m.event_type || "Meet"}
                      </span>
                      <span style={{ fontSize: 12, color: "#aaa" }}>{formatDatePretty(m.date)}</span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px", cursor: "pointer" }}
                      onClick={() => router.push(`/meets/${m.id}`)}>
                      {m.title || "Untitled Meet"}
                    </h3>
                    <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>📍 {m.city || "Location TBD"}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F0EFEB", paddingTop: 14 }}>
                      <span style={{ fontSize: 13, color: "#888" }}>by {m.host_name || "Anonymous"}</span>
                      <button onClick={() => router.push(`/meets/${m.id}`)}
                        style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        Details →
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
