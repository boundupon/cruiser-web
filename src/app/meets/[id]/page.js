"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";
import AuthModal from "../../AuthModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function formatDatePretty(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch { return iso; }
}

function formatTime(t) {
  if (!t) return "";
  try {
    const [h, m] = t.split(":");
    const d = new Date();
    d.setHours(+h, +m);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch { return t; }
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDatePretty(iso);
}

const EVENT_GRADIENTS = {
  "Cars & Coffee": "linear-gradient(135deg, #2c1810 0%, #6b3a2a 50%, #c4763a 100%)",
  "Cruise":        "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
  "Night Meet":    "linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)",
  "Show":          "linear-gradient(135deg, #1a1a1a 0%, #3d2b1f 50%, #7c4a2d 100%)",
  "Track Day":     "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #555 100%)",
};

function MeetDetailInner() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [meet, setMeet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState("signin");

  // RSVP
  const [rsvpCounts, setRsvpCounts] = useState({ going: 0, maybe: 0 });
  const [myRsvp, setMyRsvp] = useState(null); // 'going' | 'maybe' | null
  const [rsvpLoading, setRsvpLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");

  // Share
  const [copied, setCopied] = useState(false);

  // Favorites
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Map coords from geocoding
  const [mapCoords, setMapCoords] = useState(null);

  // Responsive
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // Load meet
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/meets/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Meet not found");
        const data = await res.json();
        setMeet(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  // Use stored lat/lng from database for map
  useEffect(() => {
    if (!meet) return;
    if (meet.lat && meet.lng) {
      setMapCoords({ lat: parseFloat(meet.lat), lon: parseFloat(meet.lng) });
    }
  }, [meet]);

  // Load RSVPs
  useEffect(() => {
    async function loadRsvps() {
      const res = await fetch(`${API_BASE}/meets/${id}/rsvps`);
      if (!res.ok) return;
      const data = await res.json();
      setRsvpCounts({ going: data.going, maybe: data.maybe });
      if (user) {
        const mine = data.rsvps?.find(r => r.user_id === user.id);
        setMyRsvp(mine?.status ?? null);
      }
    }
    if (id) loadRsvps();
  }, [id, user]);

  // Load comments
  useEffect(() => {
    async function loadComments() {
      const res = await fetch(`${API_BASE}/meets/${id}/comments`);
      if (!res.ok) return;
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    }
    if (id) loadComments();
  }, [id]);

  // Load favorite state
  useEffect(() => {
    async function loadFavorite() {
      if (!user || !id) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE}/favorites`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) return;
      const ids = await res.json();
      setIsFavorited(ids.includes(parseInt(id)));
    }
    loadFavorite();
  }, [user, id]);

  async function handleFavorite() {
    if (!user) { setAuthTab("signin"); setShowAuth(true); return; }
    setFavLoading(true);
    // Optimistic update
    setIsFavorited(prev => !prev);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/favorites/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setIsFavorited(data.favorited);
    } catch (e) {
      // Revert on error
      setIsFavorited(prev => !prev);
      console.error("Favorite error:", e);
    } finally {
      setFavLoading(false);
    }
  }

  async function handleRsvp(status) {
    if (!user) { setAuthTab("signin"); setShowAuth(true); return; }
    setRsvpLoading(true);
    try {
      if (myRsvp === status) {
        // Toggle off
        await supabase.from("rsvps").delete().eq("meet_id", id).eq("user_id", user.id);
        setMyRsvp(null);
        setRsvpCounts(prev => ({ ...prev, [status]: Math.max(0, prev[status] - 1) }));
      } else {
        // Upsert
        const { error } = await supabase.from("rsvps").upsert(
          { meet_id: id, user_id: user.id, status },
          { onConflict: "meet_id,user_id" }
        );
        if (error) throw error;
        // Update counts
        setRsvpCounts(prev => ({
          going: status === "going" ? prev.going + 1 : myRsvp === "going" ? prev.going - 1 : prev.going,
          maybe: status === "maybe" ? prev.maybe + 1 : myRsvp === "maybe" ? prev.maybe - 1 : prev.maybe,
        }));
        setMyRsvp(status);
      }
    } catch (e) {
      console.error("RSVP error:", e);
    } finally {
      setRsvpLoading(false);
    }
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!user) { setAuthTab("signin"); setShowAuth(true); return; }
    if (!commentBody.trim()) return;
    setCommentSubmitting(true);
    setCommentError("");
    try {
      const username = user.user_metadata?.full_name || user.email?.split("@")[0] || "Anonymous";
      const { data, error } = await supabase.from("comments").insert({
        meet_id: id,
        user_id: user.id,
        username,
        body: commentBody.trim(),
      }).select().single();
      if (error) throw error;
      setComments(prev => [...prev, data]);
      setCommentBody("");
    } catch (e) {
      setCommentError("Failed to post comment. Please try again.");
      console.error(e);
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId) {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (!error) setComments(prev => prev.filter(c => c.id !== commentId));
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share && isMobile) {
      navigator.share({ title: meet?.title, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleAddToCalendar() {
    if (!meet) return;
    const start = new Date(`${meet.date}T${meet.time || "00:00"}`);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const location = [meet.location, meet.city].filter(Boolean).join(", ");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `SUMMARY:${meet.title}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${meet.description || ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meet.title.replace(/\s+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getMapsUrl() {
    if (!meet) return "#";
    const query = encodeURIComponent([meet.location, meet.city].filter(Boolean).join(", "));
    return `https://maps.google.com/?q=${query}`;
  }

  const inp = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9", fontFamily: "inherit" };
  const lbl = { fontSize: 12, color: "#999", display: "block", marginBottom: 6 };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#aaa", fontSize: 15 }}>Loading meet...</div>
    </div>
  );

  if (error || !meet) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ fontSize: 40 }}>🚗</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Meet not found</div>
      <div style={{ fontSize: 14, color: "#888" }}>This meet may have been removed or doesn't exist.</div>
      <button onClick={() => router.push("/")}
        style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer", marginTop: 8 }}>
        Back to all meets
      </button>
    </div>
  );

  const fallback = EVENT_GRADIENTS[meet.event_type] || "linear-gradient(135deg, #1a1a1a, #444)";
  const mapsUrl = getMapsUrl();

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {showAuth && <AuthModal initialTab={authTab} onClose={() => setShowAuth(false)} onAuth={(u) => setUser(u)} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, select, button, textarea { font-family: inherit; }
        ::placeholder { color: #bbb; }
        .action-btn { transition: all 0.15s ease; }
        .action-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .comment-row:hover .delete-btn { opacity: 1 !important; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <button onClick={() => router.push("/")}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </button>
          <button onClick={() => router.push("/")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#555", cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>←</span> All Meets
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "0 0 64px" : "0 20px 80px" }}>

        {/* HERO PHOTO */}
        <div style={{
          width: "100%",
          height: isMobile ? 240 : 380,
          backgroundImage: meet.photo_url ? `url(${meet.photo_url})` : fallback,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: isMobile ? 0 : "0 0 16px 16px",
          marginBottom: 0,
          position: "relative",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)",
            borderRadius: isMobile ? 0 : "0 0 16px 16px",
          }} />
          <div style={{ position: "absolute", bottom: 20, left: 24, right: 24 }}>
            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "white", padding: "4px 12px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.2)" }}>
              {meet.event_type || "Meet"}
            </span>
            <h1 style={{ fontSize: isMobile ? 22 : 32, fontWeight: 700, color: "white", margin: "8px 0 0", textShadow: "0 2px 12px rgba(0,0,0,0.4)", lineHeight: 1.2 }}>
              {meet.title}
            </h1>
          </div>
        </div>

        <div style={{ padding: isMobile ? "0 0 0" : "0" }}>

          {/* OPTION B — Two Column Panel */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 220px",
            border: "1.5px solid #E8E8E4",
            borderRadius: isMobile ? 0 : 16,
            overflow: "hidden",
            marginBottom: 32,
            marginTop: isMobile ? 0 : 24,
            background: "white",
          }}>

            {/* Left: Info + Description */}
            <div style={{ padding: "28px 24px", borderRight: isMobile ? "none" : "1px solid #F0EFEB", borderBottom: isMobile ? "1px solid #F0EFEB" : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Date & Time</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{formatDatePretty(meet.date)}</div>
                  {meet.time && <div style={{ fontSize: 13, color: "#888", marginTop: 1 }}>{formatTime(meet.time)}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Location</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{meet.location || meet.city}</div>
                  {meet.location && <div style={{ fontSize: 13, color: "#888", marginTop: 1 }}>{meet.city}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Hosted by</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{meet.host_name || "Anonymous"}</div>
                  {meet.host_contact && <div style={{ fontSize: 13, color: "#888", marginTop: 1 }}>{meet.host_contact}</div>}
                </div>
              </div>

              {meet.description && (
                <div style={{ borderTop: "1px solid #F0EFEB", paddingTop: 18 }}>
                  <div style={{ fontSize: 11, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>About this meet</div>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.65, margin: 0 }}>{meet.description}</p>
                </div>
              )}
            </div>

            {/* Right: RSVP + Actions */}
            <div style={{ padding: "24px", background: "#FAFAF9", display: "flex", flexDirection: "column", gap: 8 }}>

              {/* RSVP buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
                <button onClick={() => handleRsvp("going")} disabled={rsvpLoading}
                  style={{
                    background: myRsvp === "going" ? "#1a1a1a" : "white",
                    color: myRsvp === "going" ? "white" : "#1a1a1a",
                    border: `1.5px solid ${myRsvp === "going" ? "#1a1a1a" : "#E8E8E4"}`,
                    borderRadius: 8, padding: "11px 8px", fontSize: 13, fontWeight: 500,
                    cursor: rsvpLoading ? "not-allowed" : "pointer", textAlign: "center",
                  }}>
                  {myRsvp === "going" ? "✓ " : ""}Going
                  <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2, fontWeight: 400 }}>{rsvpCounts.going} {rsvpCounts.going === 1 ? "person" : "people"}</div>
                </button>
                <button onClick={() => handleRsvp("maybe")} disabled={rsvpLoading}
                  style={{
                    background: myRsvp === "maybe" ? "#1a1a1a" : "white",
                    color: myRsvp === "maybe" ? "white" : "#1a1a1a",
                    border: `1.5px solid ${myRsvp === "maybe" ? "#1a1a1a" : "#E8E8E4"}`,
                    borderRadius: 8, padding: "11px 8px", fontSize: 13, fontWeight: 500,
                    cursor: rsvpLoading ? "not-allowed" : "pointer", textAlign: "center",
                  }}>
                  {myRsvp === "maybe" ? "✓ " : ""}Maybe
                  <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2, fontWeight: 400 }}>{rsvpCounts.maybe} {rsvpCounts.maybe === 1 ? "person" : "people"}</div>
                </button>
              </div>

              {/* Action buttons */}
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "#1a1a1a", textDecoration: "none" }}>
                Get Directions
                <span style={{ color: "#bbb", fontSize: 12 }}>↗</span>
              </a>

              <button onClick={handleAddToCalendar}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "#1a1a1a", cursor: "pointer", textAlign: "left" }}>
                Add to Calendar
                <span style={{ color: "#bbb", fontSize: 12 }}>↓</span>
              </button>

              <button onClick={handleShare}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: copied ? "#F0FDF4" : "white",
                  border: `1.5px solid ${copied ? "#BBF7D0" : "#E8E8E4"}`,
                  borderRadius: 8, padding: "11px 14px", fontSize: 13, fontWeight: 500,
                  color: copied ? "#166534" : "#1a1a1a", cursor: "pointer", textAlign: "left",
                }}>
                {copied ? "Link copied!" : "Share Event"}
                <span style={{ color: copied ? "#166534" : "#bbb", fontSize: 12 }}>{copied ? "✓" : "⧉"}</span>
              </button>

              <button onClick={handleFavorite} disabled={favLoading}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: isFavorited ? "#FFF1F2" : "white",
                  border: `1.5px solid ${isFavorited ? "#FECDD3" : "#E8E8E4"}`,
                  borderRadius: 8, padding: "11px 14px", fontSize: 13, fontWeight: 500,
                  color: isFavorited ? "#E11D48" : "#1a1a1a", cursor: favLoading ? "not-allowed" : "pointer", textAlign: "left",
                  opacity: favLoading ? 0.7 : 1,
                }}>
                {isFavorited ? "❤️ Saved" : "🤍 Save Meet"}
                <span style={{ fontSize: 12 }}>{isFavorited ? "✓" : "+"}</span>
              </button>
            </div>
          </div>

          {/* DIVIDER */}
          <div style={{ borderTop: "1px solid #ECEAE6", marginBottom: 32, margin: isMobile ? "0 16px 32px" : "0 0 32px" }} />

          {/* MAP SECTION */}
          <div style={{ marginBottom: 40, padding: isMobile ? "0 16px" : 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 16px" }}>Location</h2>
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1.5px solid #E8E8E4", position: "relative", background: "#f0efeb" }}>
              {mapCoords ? (
                <iframe
                  title="Meet location map"
                  width="100%"
                  height={isMobile ? 240 : 340}
                  frameBorder="0"
                  scrolling="no"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lon - 0.01},${mapCoords.lat - 0.007},${mapCoords.lon + 0.01},${mapCoords.lat + 0.007}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lon}`}
                  style={{ display: "block" }}
                />
              ) : (
                <div style={{ height: isMobile ? 240 : 340, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 14 }}>
                  Loading map...
                </div>
              )}
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                style={{
                  position: "absolute", bottom: 12, right: 12,
                  background: "white", border: "1.5px solid #E8E8E4",
                  borderRadius: 8, padding: "7px 14px", fontSize: 12,
                  fontWeight: 500, color: "#1a1a1a", textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}>
                Open in Google Maps ↗
              </a>
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
              📍 {[meet.location, meet.city].filter(Boolean).join(", ")}
            </div>
          </div>

          {/* DIVIDER */}
          <div style={{ borderTop: "1px solid #ECEAE6", marginBottom: 32 }} />

          {/* COMMENTS SECTION */}
          <div style={{ padding: isMobile ? "0 16px" : 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 20px" }}>
              Comments <span style={{ fontSize: 14, fontWeight: 400, color: "#aaa" }}>({comments.length})</span>
            </h2>

            {/* Comment input */}
            <div style={{ marginBottom: 28 }}>
              {user ? (
                <form onSubmit={handleCommentSubmit}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, background: "#1a1a1a", borderRadius: "50%", display: "grid", placeItems: "center", color: "white", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {(user.user_metadata?.full_name || user.email || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Ask a question or leave a comment..."
                        rows={3}
                        style={{ ...inp, resize: "vertical", marginBottom: 8 }}
                      />
                      {commentError && (
                        <div style={{ fontSize: 13, color: "#991B1B", marginBottom: 8 }}>{commentError}</div>
                      )}
                      <button type="submit" disabled={commentSubmitting || !commentBody.trim()}
                        style={{
                          background: "#1a1a1a", color: "white", border: "none", borderRadius: 8,
                          padding: "9px 20px", fontSize: 13, fontWeight: 500,
                          cursor: commentSubmitting || !commentBody.trim() ? "not-allowed" : "pointer",
                          opacity: commentSubmitting || !commentBody.trim() ? 0.5 : 1,
                        }}>
                        {commentSubmitting ? "Posting..." : "Post Comment"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Join the conversation</div>
                    <div style={{ fontSize: 13, color: "#888" }}>Sign in to ask questions or leave a comment.</div>
                  </div>
                  <button onClick={() => { setAuthTab("signin"); setShowAuth(true); }}
                    style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Sign in
                  </button>
                </div>
              )}
            </div>

            {/* Comments list */}
            {comments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#bbb", fontSize: 14 }}>
                No comments yet. Be the first to say something!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {comments.map((c) => (
                  <div key={c.id} className="comment-row"
                    style={{ display: "flex", gap: 12, padding: "16px 0", borderBottom: "1px solid #F0EFEB", position: "relative" }}>
                    {/* Avatar */}
                    <div style={{ width: 36, height: 36, background: "#E8E8E4", borderRadius: "50%", display: "grid", placeItems: "center", color: "#555", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {(c.username || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.username}</span>
                        <span style={{ fontSize: 12, color: "#bbb" }}>{timeAgo(c.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 14, color: "#333", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{c.body}</p>
                    </div>
                    {/* Delete button (own comments) */}
                    {user?.id === c.user_id && (
                      <button className="delete-btn" onClick={() => handleDeleteComment(c.id)}
                        style={{ position: "absolute", top: 16, right: 0, background: "none", border: "none", color: "#ccc", fontSize: 16, cursor: "pointer", opacity: 0, transition: "opacity 0.15s", padding: "0 4px" }}
                        title="Delete comment">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function MeetDetail() {
  return (
    <Suspense fallback={null}>
      <MeetDetailInner />
    </Suspense>
  );
}
