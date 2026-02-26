"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const GROUP_TYPES = [
  { value: "", label: "All Types" },
  { value: "car_club", label: "Car Clubs" },
  { value: "brand_model", label: "Brand / Model" },
  { value: "regional_crew", label: "Regional Crews" },
  { value: "event_organizer", label: "Event Organizers" },
];

const TYPE_META = {
  car_club:         { label: "Car Club",         color: "#1a1a1a", bg: "#F0EFEB" },
  brand_model:      { label: "Brand / Model",    color: "#1D4ED8", bg: "#EFF6FF" },
  regional_crew:    { label: "Regional Crew",    color: "#065F46", bg: "#ECFDF5" },
  event_organizer:  { label: "Event Organizer",  color: "#92400E", bg: "#FFFBEB" },
};

function GroupCard({ group, onClick }) {
  const meta = TYPE_META[group.type] || TYPE_META.car_club;
  return (
    <div onClick={onClick} style={{
      background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12,
      overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Banner */}
      <div style={{
        height: 80, background: group.banner_url
          ? `url(${group.banner_url}) center/cover`
          : "linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 100%)",
        position: "relative",
      }}>
        {/* Avatar */}
        <div style={{
          position: "absolute", bottom: -20, left: 16,
          width: 48, height: 48, borderRadius: 10,
          border: "2.5px solid white",
          background: group.avatar_url ? `url(${group.avatar_url}) center/cover` : "#E8E8E4",
          display: "grid", placeItems: "center",
          fontSize: 20, fontWeight: 700, color: "#555",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}>
          {!group.avatar_url && group.name[0].toUpperCase()}
        </div>
        {/* Privacy badge */}
        {group.privacy === "private" && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(0,0,0,0.55)", color: "white",
            fontSize: 10, fontWeight: 600, borderRadius: 5,
            padding: "3px 7px", letterSpacing: "0.04em",
          }}>🔒 Private</div>
        )}
      </div>

      <div style={{ padding: "28px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: 0, lineHeight: 1.3 }}>{group.name}</h3>
          <span style={{
            fontSize: 10, fontWeight: 600, borderRadius: 5, padding: "3px 7px",
            color: meta.color, background: meta.bg, whiteSpace: "nowrap", flexShrink: 0,
            letterSpacing: "0.03em",
          }}>{meta.label}</span>
        </div>
        {group.description && (
          <p style={{ fontSize: 13, color: "#777", margin: "0 0 10px", lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{group.description}</p>
        )}
        <div style={{ fontSize: 12, color: "#aaa", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {group.member_count} {group.member_count === 1 ? "member" : "members"}
          {group.location && <><span style={{ margin: "0 4px" }}>·</span>📍 {group.location}</>}
        </div>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (typeFilter) params.set("type", typeFilter);
        if (search) params.set("search", search);
        params.set("limit", "48");
        const res = await fetch(`${API_BASE}/groups?${params}`);
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [typeFilter, search]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            {user ? (
              <button onClick={() => router.push("/groups/create")}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Create Group
              </button>
            ) : (
              <button onClick={() => router.push("/")}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Sign In
              </button>
            )}
            <button onClick={() => router.push("/")}
              style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#555", cursor: "pointer" }}>
              ← All Meets
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "24px 16px" : "40px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 28 : 36, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.1 }}>
            Groups
          </h1>
          <p style={{ fontSize: 15, color: "#888", margin: 0 }}>Find your crew, club, or car community.</p>
        </div>

        {/* Search + filters */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 32 }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: "flex", gap: 8 }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search groups..."
              style={{ flex: 1, border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", background: "white", fontFamily: "inherit", color: "#1a1a1a" }}
            />
            <button type="submit" style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Search
            </button>
          </form>

          {/* Type filter pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GROUP_TYPES.map(t => (
              <button key={t.value} onClick={() => setTypeFilter(t.value)}
                style={{
                  background: typeFilter === t.value ? "#1a1a1a" : "white",
                  color: typeFilter === t.value ? "white" : "#555",
                  border: "1.5px solid",
                  borderColor: typeFilter === t.value ? "#1a1a1a" : "#E8E8E4",
                  borderRadius: 20, padding: "7px 14px", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", transition: "all 0.1s",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#aaa", padding: "60px 0", fontSize: 15 }}>Loading groups...</div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No groups found</div>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>
              {search ? `No results for "${search}"` : "Be the first to create one."}
            </div>
            {user ? (
              <button onClick={() => router.push("/groups/create")}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Create a Group
              </button>
            ) : (
              <button onClick={() => router.push("/")}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Sign In to Create a Group
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {groups.map(g => (
              <GroupCard key={g.id} group={g} onClick={() => router.push(`/groups/${g.slug}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
