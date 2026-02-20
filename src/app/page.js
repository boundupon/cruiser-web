"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function formatDatePretty(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function Home() {
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("find"); // default to find

  // search + filters
  const [location, setLocation] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [eventType, setEventType] = useState("All Types");
  const [radius, setRadius] = useState("25 mi");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searched, setSearched] = useState(false);

  // host form state
  const [hostTitle, setHostTitle] = useState("");
  const [hostCity, setHostCity] = useState("");
  const [hostLocation, setHostLocation] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostContact, setHostContact] = useState("");
  const [hostDate, setHostDate] = useState("");
  const [hostTime, setHostTime] = useState("");
  const [hostEventType, setHostEventType] = useState("Cars & Coffee");
  const [hostDescription, setHostDescription] = useState("");
  const [hostSubmitting, setHostSubmitting] = useState(false);
  const [hostSuccess, setHostSuccess] = useState(false);
  const [hostError, setHostError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/meets`, { cache: "no-store" });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setMeets(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e?.message || "Failed to load meets");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const EVENT_TYPES = ["All Types", "Cars & Coffee", "Night Meet", "Cruise", "Show", "Track Day"];
  const RADII = ["5 mi", "10 mi", "25 mi", "50 mi", "100 mi"];

  const filtered = useMemo(() => {
    let list = [...meets];
    if (location.trim()) {
      const needle = location.trim().toLowerCase();
      list = list.filter((m) =>
        `${m.city || ""} ${m.title || ""}`.toLowerCase().includes(needle)
      );
    }
    if (eventType !== "All Types") {
      list = list.filter((m) => (m.type || "").toLowerCase() === eventType.toLowerCase());
    }
    if (dateFrom) list = list.filter((m) => (m.date || "") >= dateFrom);
    if (dateTo) list = list.filter((m) => (m.date || "") <= dateTo);
    return list;
  }, [meets, location, eventType, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  useEffect(() => { setPage(1); }, [location, eventType, dateFrom, dateTo]);

  function handleSearch(e) {
    e.preventDefault();
    setMode("find");
    setSearched(true);
  }

  async function handleHostSubmit(e) {
    e.preventDefault();
    setHostSubmitting(true);
    setHostError("");
    try {
      const res = await fetch(`${API_BASE}/meets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: hostTitle,
          city: hostCity,
          location: hostLocation,
          host_name: hostName,
          host_contact: hostContact,
          date: hostDate,
          time: hostTime,
          event_type: hostEventType,
          description: hostDescription,
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setHostSuccess(true);
      // reset form
      setHostTitle(""); setHostCity(""); setHostLocation("");
      setHostName(""); setHostContact(""); setHostDate("");
      setHostTime(""); setHostDescription("");
      setHostEventType("Cars & Coffee");
    } catch (err) {
      setHostError("Something went wrong. Please try again.");
    } finally {
      setHostSubmitting(false);
    }
  }
    setLocation("");
    setEventType("All Types");
    setRadius("25 mi");
    setDateFrom("");
    setDateTo("");
    setSearched(false);
    setMode(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>

      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, select, button { font-family: inherit; }
        ::placeholder { color: #bbb; }
        .meet-card:hover { border-color: #d0d0cc !important; box-shadow: 0 4px 24px rgba(0,0,0,0.07) !important; transform: translateY(-1px); }
        .meet-card { transition: all 0.18s ease; }
        .chip:hover { border-color: #1a1a1a !important; color: #1a1a1a !important; }
        .split-btn:hover { background: #f5f5f3 !important; }
        .nav-link:hover { color: #1a1a1a !important; }
        .filter-toggle:hover { color: #555 !important; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .stats-row { gap: 24px !important; }
          .nav-links { display: none !important; }
          .hero-text h1 { font-size: 36px !important; }
        }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "relative" }}>
          <button onClick={clearAll} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </button>

          <nav className="nav-links" style={{ display: "flex", gap: 28, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            {["Events", "Submit Event", "About"].map((l) => (
              <a key={l} className="nav-link" href="#" style={{ fontSize: 14, color: "#888", textDecoration: "none", transition: "color 0.15s" }}>{l}</a>
            ))}
          </nav>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "#555", cursor: "pointer" }}>Sign in</button>
            <button style={{ background: "#1a1a1a", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "white", fontWeight: 500, cursor: "pointer" }}>Sign up</button>
          </div>
        </div>
      </header>

      {/* HERO IMAGE — full width, tall */}
      <section style={{ position: "relative", height: 480, overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('/hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 45%",
        }} />
        {/* Overlays for readability */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.35) 50%, rgba(250,250,249,0.9) 90%, #FAFAF9 100%)" }} />

        {/* Headline centered over the cars */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 32px" }}>
          <h1 style={{ fontSize: 56, fontWeight: 300, lineHeight: 1.08, letterSpacing: "-0.02em", margin: 0, color: "white", textShadow: "0 2px 24px rgba(0,0,0,0.35)" }}>
            Find <span style={{ fontWeight: 700 }}>car meets</span> near you.
          </h1>
        </div>
      </section>

      {/* SEARCH + INTENT PANEL — sits cleanly below the image */}
      <section style={{ background: "#FAFAF9", padding: "0 32px 48px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Find / Host toggle */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#E8E8E4", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <button
              className="split-btn"
              onClick={() => setMode("find")}
              style={{
                background: mode === "host" ? "white" : "#1a1a1a",
                border: "none", padding: "18px 24px", textAlign: "left",
                cursor: "pointer", transition: "all 0.15s"
              }}
            >
              <div style={{ fontSize: 11, color: mode === "host" ? "#aaa" : "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>I want to</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: mode === "host" ? "#1a1a1a" : "white" }}>Find a Meet →</div>
            </button>
            <button
              className="split-btn"
              onClick={() => setMode("host")}
              style={{
                background: mode === "host" ? "#1a1a1a" : "white",
                border: "none", padding: "18px 24px", textAlign: "left",
                cursor: "pointer", transition: "all 0.15s"
              }}
            >
              <div style={{ fontSize: 11, color: mode === "host" ? "rgba(255,255,255,0.6)" : "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>I want to</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: mode === "host" ? "white" : "#1a1a1a" }}>Host a Meet →</div>
            </button>
          </div>

          {/* Search / Host form panel */}
          <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 16, padding: 28, boxShadow: "0 2px 24px rgba(0,0,0,0.05)" }}>
            {mode !== "host" ? (
              <form onSubmit={handleSearch}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>City or zip code</label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Norfolk, VA or 23510"
                      style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "12px 14px", fontSize: 15, outline: "none", color: "#1a1a1a", background: "#FAFAF9" }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", height: 46 }}
                  >
                    Search Meets →
                  </button>
                </div>

                {/* Radius chips */}
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#aaa", marginRight: 4 }}>Radius:</span>
                  {RADII.map((r) => (
                    <button
                      key={r} type="button" onClick={() => setRadius(r)} className="chip"
                      style={{
                        border: `1.5px solid ${radius === r ? "#1a1a1a" : "#E8E8E4"}`,
                        background: radius === r ? "#1a1a1a" : "white",
                        color: radius === r ? "white" : "#777",
                        borderRadius: 100, padding: "5px 14px", fontSize: 12, cursor: "pointer", transition: "all 0.15s"
                      }}
                    >{r}</button>
                  ))}
                </div>

                {/* Filters toggle */}
                <button
                  type="button" className="filter-toggle"
                  onClick={() => setShowFilters(!showFilters)}
                  style={{ background: "none", border: "none", fontSize: 13, color: "#aaa", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, transition: "color 0.15s" }}
                >
                  <span>{showFilters ? "−" : "+"}</span>
                  {showFilters ? "Hide filters" : "More filters"}
                </button>

                {showFilters && (
                  <div style={{ borderTop: "1px solid #F0EFEB", paddingTop: 16, marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Event type</label>
                      <select value={eventType} onChange={(e) => setEventType(e.target.value)}
                        style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#FAFAF9", outline: "none" }}>
                        {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Date from</label>
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                        style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#FAFAF9", outline: "none" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Date to</label>
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                        style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#FAFAF9", outline: "none" }} />
                    </div>
                  </div>
                )}
              </form>
            ) : (
              /* HOST FORM */
              <div>
                {hostSuccess ? (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>Meet submitted for review!</div>
                    <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>We'll review your meet and approve it shortly.</div>
                    <button onClick={() => setHostSuccess(false)}
                      style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
                      Submit another meet
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleHostSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Event title *</label>
                        <input required value={hostTitle} onChange={(e) => setHostTitle(e.target.value)}
                          placeholder="e.g. Sunday Morning Cars & Coffee"
                          style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>City *</label>
                        <input required value={hostCity} onChange={(e) => setHostCity(e.target.value)}
                          placeholder="e.g. Norfolk"
                          style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9" }} />
                      </div>
                      <div style={{ gridColumn: "2 / -1" }}>
                        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Location / venue</label>
                        <input value={hostLocation} onChange={(e) => setHostLocation(e.target.value)}
                          placeholder="e.g. Waterside District"
                          style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Host name *</label>
                        <input required value={hostName} onChange={(e) => setHostName(e.target.value)}
                          placeholder="Your name or group"
                          style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9" }} />
                      </div>
                      <div style={{ gridColumn: "2 / -1" }}>
                        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Contact (Instagram, phone, etc)</label>
                        <input value={hostContact} onChange={(e) => setHostContact(e.target.value)}
                          placeholder="e.g. @yourhandle"
                          style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Date *</label>
                        <input required type="date" value={hostDate} onChange={(e) => setHostDate(e.target.value)}
                          style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#FAFAF9", outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Time *</label>
                        <input required type="time" value={hostTime} onChange={(e) => setHostTime(e.target.value)}
                          style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#FAFAF9", outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Event type *</label>
                        <select required value={hostEventType} onChange={(e) => setHostEventType(e.target.value)}
                          style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#FAFAF9", outline: "none" }}>
                          {EVENT_TYPES.slice(1).map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 6 }}>Description</label>
                      <textarea value={hostDescription} onChange={(e) => setHostDescription(e.target.value)}
                        placeholder="Tell people about your meet..." rows={3}
                        style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9", resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                    {hostError && (
                      <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 12 }}>
                        {hostError}
                      </div>
                    )}
                    <button type="submit" disabled={hostSubmitting}
                      style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: hostSubmitting ? "not-allowed" : "pointer", opacity: hostSubmitting ? 0.7 : 1 }}>
                      {hostSubmitting ? "Submitting..." : "Submit for Review →"}
                    </button>
                  </form>
                )}
              </div>
          </div>

          {/* Stats row */}
          <div className="stats-row" style={{ display: "flex", gap: 40, marginTop: 28, paddingLeft: 4 }}>
            {[["248", "Active meets"], ["34", "Cities"], ["12k", "Enthusiasts"]].map(([num, label]) => (
              <div key={label}>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a" }}>{num}</div>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS — only show after search or mode=find */}
      {(searched || mode === "find") && (
        <section id="events" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 64px" }}>
          <div style={{ borderTop: "1px solid #ECEAE6", paddingTop: 40, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                {loading ? "Loading meets..." : `${filtered.length} meet${filtered.length === 1 ? "" : "s"} found`}
              </h2>
              {location && <p style={{ fontSize: 14, color: "#aaa", marginTop: 4 }}>Near "{location}" · {radius}</p>}
            </div>
            <button onClick={clearAll} style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
              Clear search
            </button>
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 18px", fontSize: 14, color: "#991B1B", marginBottom: 24 }}>
              Could not load meets — {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 220, borderRadius: 12, background: "#F0EFEB", animation: "pulse 1.5s infinite" }} />
            ))}

            {!loading && !error && paged.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 15 }}>
                No meets found matching your search. Try a different city or expand your radius.
              </div>
            )}

            {!loading && !error && paged.map((m) => (
              <article
                key={m.id}
                className="meet-card"
                style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, overflow: "hidden", cursor: "pointer" }}
              >
                {/* Card color bar */}
                <div style={{ height: 4, background: "#1a1a1a" }} />

                <div style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, background: "#F5F5F3", color: "#777", padding: "4px 10px", borderRadius: 100, letterSpacing: "0.05em" }}>
                      {m.event_type || "Meet"}
                    </span>
                    <span style={{ fontSize: 12, color: "#aaa" }}>{formatDatePretty(m.date)}</span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px", lineHeight: 1.3 }}>{m.title || "Untitled Meet"}</h3>
                  <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>📍 {m.city || "Location TBD"}</p>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F0EFEB", paddingTop: 14 }}>
                    <span style={{ fontSize: 13, color: "#888" }}>by {m.host_name || "Anonymous"}</span>
                    <a
                      href={`${API_BASE}/meets/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", textDecoration: "none" }}
                    >
                      Details →
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          {!loading && !error && filtered.length > PAGE_SIZE && (
            <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe === 1}
                style={{ border: "1.5px solid #E8E8E4", background: "white", borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer", opacity: pageSafe === 1 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  style={{
                    border: "1.5px solid",
                    borderColor: pageSafe === i + 1 ? "#1a1a1a" : "#E8E8E4",
                    background: pageSafe === i + 1 ? "#1a1a1a" : "white",
                    color: pageSafe === i + 1 ? "white" : "#1a1a1a",
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe === totalPages}
                style={{ border: "1.5px solid #E8E8E4", background: "white", borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer", opacity: pageSafe === totalPages ? 0.4 : 1 }}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      )}

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #ECEAE6", padding: "32px", background: "#FAFAF9" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#aaa" }}>
          <span>© {new Date().getFullYear()} Cruiser</span>
          <div style={{ display: "flex", gap: 24 }}>
            {["Events", "Submit", "About"].map((l) => (
              <a key={l} href="#" style={{ color: "#aaa", textDecoration: "none" }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
