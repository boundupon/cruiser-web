"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const TYPE_META = {
  car_club:         { label: "Car Club",         color: "#1a1a1a", bg: "#F0EFEB" },
  brand_model:      { label: "Brand / Model",    color: "#1D4ED8", bg: "#EFF6FF" },
  regional_crew:    { label: "Regional Crew",    color: "#065F46", bg: "#ECFDF5" },
  event_organizer:  { label: "Event Organizer",  color: "#92400E", bg: "#FFFBEB" },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function GroupPage() {
  const router = useRouter();
  const { slug } = useParams();

  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [meets, setMeets] = useState([]);
  const [membership, setMembership] = useState({ role: null, status: null });
  const [activeTab, setActiveTab] = useState("about");
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      try {
        const [gRes, mRes, meetsRes] = await Promise.all([
          fetch(`${API_BASE}/groups/${slug}`),
          fetch(`${API_BASE}/groups/${slug}/members`),
          fetch(`${API_BASE}/groups/${slug}/meets`),
        ]);
        if (!gRes.ok) { setGroup(null); setLoading(false); return; }
        const [g, m, mt] = await Promise.all([gRes.json(), mRes.json(), meetsRes.json()]);
        setGroup(g);
        setMembers(Array.isArray(m) ? m : []);
        setMeets(Array.isArray(mt) ? mt : []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!slug || !user) return;
    async function loadMembership() {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await fetch(`${API_BASE}/groups/${slug}/membership`, { headers });
      if (res.ok) setMembership(await res.json());
    }
    loadMembership();
  }, [slug, user]);

  async function handleJoin() {
    if (!user) { router.push("/"); return; }
    setJoining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/groups/${slug}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setMembership({ role: "member", status: data.status });
      if (data.status === "active") {
        setGroup(prev => ({ ...prev, member_count: prev.member_count + 1 }));
        // Reload members
        const mRes = await fetch(`${API_BASE}/groups/${slug}/members`);
        setMembers(await mRes.json());
      }
    } catch (e) { console.error(e); }
    finally { setJoining(false); }
  }

  async function handleLeave() {
    if (!confirm("Leave this group?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${API_BASE}/groups/${slug}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setMembership({ role: null, status: null });
    setGroup(prev => ({ ...prev, member_count: Math.max(0, prev.member_count - 1) }));
    const mRes = await fetch(`${API_BASE}/groups/${slug}/members`);
    setMembers(await mRes.json());
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: "#aaa", fontSize: 15 }}>Loading group...</div>
    </div>
  );

  if (!group) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 40 }}>🏁</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Group not found</div>
      <button onClick={() => router.push("/groups")} style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
        Browse Groups
      </button>
    </div>
  );

  const meta = TYPE_META[group.type] || TYPE_META.car_club;
  const isOwner = membership.role === "owner";
  const isMod = membership.role === "moderator";
  const isActive = membership.status === "active";
  const isPending = membership.status === "pending";
  const canManage = isOwner || isMod;
  const owner = members.find(m => m.role === "owner");

  const tabs = [
    { id: "about", label: "About" },
    { id: "members", label: `Members (${members.length})` },
    { id: "meets", label: `Meets (${meets.length})` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Cruiser</span>
          </button>
          <button onClick={() => router.push("/groups")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#555", cursor: "pointer" }}>
            ← All Groups
          </button>
        </div>
      </header>

      {/* BANNER */}
      <div style={{
        height: isMobile ? 160 : 220,
        background: group.banner_url ? `url(${group.banner_url}) center/cover` : "linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 60%, #555 100%)",
        position: "relative",
      }}>
        {/* Avatar */}
        <div style={{
          position: "absolute", bottom: -32, left: isMobile ? 16 : 32,
          width: 72, height: 72, borderRadius: 14,
          border: "3px solid white",
          background: group.avatar_url ? `url(${group.avatar_url}) center/cover` : "#E8E8E4",
          display: "grid", placeItems: "center",
          fontSize: 28, fontWeight: 700, color: "#555",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        }}>
          {!group.avatar_url && group.name[0].toUpperCase()}
        </div>
      </div>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "0 16px 60px" : "0 20px 80px" }}>

        {/* Group header row */}
        <div style={{ paddingTop: 48, paddingBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>{group.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: meta.color, background: meta.bg, letterSpacing: "0.03em" }}>{meta.label}</span>
              {group.privacy === "private" && (
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: "#555", background: "#F0EFEB" }}>🔒 Private</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#aaa", display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {group.member_count} members
              </span>
              {group.location && <span>📍 {group.location}</span>}
              {owner && <span>Owner: <button onClick={() => router.push(`/u/${owner.profiles?.username}`)} style={{ background: "none", border: "none", padding: 0, color: "#555", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>@{owner.profiles?.username}</button></span>}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {canManage && (
              <button onClick={() => router.push(`/groups/${slug}/manage`)}
                style={{ background: "white", color: "#1a1a1a", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Manage
              </button>
            )}
            {!membership.role && (
              <button onClick={handleJoin} disabled={joining}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: joining ? "not-allowed" : "pointer", opacity: joining ? 0.7 : 1 }}>
                {joining ? "..." : group.privacy === "private" ? "Request to Join" : "Join Group"}
              </button>
            )}
            {isPending && (
              <div style={{ background: "#FFFBEB", color: "#92400E", border: "1.5px solid #FDE68A", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500 }}>
                ⏳ Request pending
              </div>
            )}
            {isActive && !isOwner && (
              <button onClick={handleLeave}
                style={{ background: "white", color: "#888", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>
                Leave
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #ECEAE6", marginBottom: 28, display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                background: "none", border: "none", padding: "10px 16px", fontSize: 14, fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? "#1a1a1a" : "#aaa", cursor: "pointer",
                borderBottom: `2px solid ${activeTab === t.id ? "#1a1a1a" : "transparent"}`,
                marginBottom: -1, transition: "color 0.1s",
              }}>{t.label}</button>
          ))}
        </div>

        {/* About tab */}
        {activeTab === "about" && (
          <div style={{ maxWidth: 600 }}>
            {group.description ? (
              <p style={{ fontSize: 15, color: "#444", lineHeight: 1.7, margin: "0 0 24px" }}>{group.description}</p>
            ) : (
              <p style={{ fontSize: 14, color: "#aaa", fontStyle: "italic" }}>No description yet.</p>
            )}
            <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span style={{ color: "#aaa", minWidth: 80 }}>Type</span>
                <span style={{ fontWeight: 500, color: meta.color }}>{meta.label}</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span style={{ color: "#aaa", minWidth: 80 }}>Privacy</span>
                <span style={{ fontWeight: 500 }}>{group.privacy === "private" ? "🔒 Private" : "🌐 Public"}</span>
              </div>
              {group.location && (
                <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                  <span style={{ color: "#aaa", minWidth: 80 }}>Location</span>
                  <span style={{ fontWeight: 500 }}>📍 {group.location}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span style={{ color: "#aaa", minWidth: 80 }}>Founded</span>
                <span style={{ fontWeight: 500 }}>{new Date(group.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Members tab */}
        {activeTab === "members" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.length === 0 ? (
              <div style={{ color: "#aaa", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No members yet.</div>
            ) : members.map(m => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: m.profiles?.profile_photo_url ? `url(${m.profiles.profile_photo_url}) center/cover` : "#E8E8E4",
                  display: "grid", placeItems: "center", fontSize: 15, fontWeight: 600, color: "#555", flexShrink: 0,
                }}>
                  {!m.profiles?.profile_photo_url && (m.profiles?.username || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <button onClick={() => router.push(`/u/${m.profiles?.username}`)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
                    @{m.profiles?.username}
                  </button>
                  <div style={{ fontSize: 12, color: "#aaa" }}>Joined {timeAgo(m.joined_at)}</div>
                </div>
                {m.role !== "member" && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, borderRadius: 5, padding: "3px 8px",
                    background: m.role === "owner" ? "#1a1a1a" : "#F0EFEB",
                    color: m.role === "owner" ? "white" : "#555",
                  }}>{m.role === "owner" ? "Owner" : "Mod"}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Meets tab */}
        {activeTab === "meets" && (
          <div>
            {meets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
                <div style={{ fontSize: 15, color: "#888" }}>No meets linked to this group yet.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {meets.map(m => (
                  <div key={m.id} onClick={() => router.push(`/meets/${m.id}`)}
                    style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: "16px", cursor: "pointer", transition: "box-shadow 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                    <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{m.event_type}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 13, color: "#777" }}>{m.city} · {new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
