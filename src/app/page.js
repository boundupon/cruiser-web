"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "./supabaseClient";
import AuthModal from "./AuthModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || "";

function formatDatePretty(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function HomeInner() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState("signin");
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(() => searchParams.get("admin") === "true" ? "admin" : "find");

  const [location, setLocation] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [eventType, setEventType] = useState("All Types");
  const [radius, setRadius] = useState("25 mi");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searched, setSearched] = useState(false);

  const [hostTitle, setHostTitle] = useState("");
  const [hostCity, setHostCity] = useState("");
  const [hostLocation, setHostLocation] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostContact, setHostContact] = useState("");
  const [hostDate, setHostDate] = useState("");
  const [hostTime, setHostTime] = useState("");
  const [hostEventType, setHostEventType] = useState("Cars & Coffee");
  const [hostDescription, setHostDescription] = useState("");
  const [hostPhoto, setHostPhoto] = useState("");
  const [hostPhotoFile, setHostPhotoFile] = useState(null);
  const [hostPhotoPreview, setHostPhotoPreview] = useState("");
  const [hostPhotoUploading, setHostPhotoUploading] = useState(false);
  const [hostSubmitting, setHostSubmitting] = useState(false);
  const [hostSuccess, setHostSuccess] = useState(false);
  const [hostError, setHostError] = useState("");

  const PAGE_SIZE = 6;
  const [page, setPage] = useState(1);

  // Admin state
  const [adminMeets, setAdminMeets] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminActionMsg, setAdminActionMsg] = useState("");

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
      list = list.filter((m) => (m.event_type || "").toLowerCase() === eventType.toLowerCase());
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

  function clearAll() {
    setLocation("");
    setEventType("All Types");
    setRadius("25 mi");
    setDateFrom("");
    setDateTo("");
    setSearched(false);
    setMode("find");
  }

  async function loadAdminMeets() {
    setAdminLoading(true);
    setAdminError("");
    try {
      const res = await fetch(`${API_BASE}/admin/meets`, {
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setAdminMeets(Array.isArray(data) ? data : []);
    } catch (e) {
      setAdminError(e?.message || "Failed to load");
    } finally {
      setAdminLoading(false);
    }
  }

  async function adminUpdateStatus(id, status) {
    try {
      const res = await fetch(`${API_BASE}/admin/meets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      setAdminMeets((prev) => prev.filter((m) => m.id !== id));
      setAdminActionMsg(`Meet ${status} ✓`);
      setTimeout(() => setAdminActionMsg(""), 2500);
    } catch {
      setAdminError("Action failed. Try again.");
    }
  }

  function handleAdminLogin(e) {
    e.preventDefault();
    if (adminPassword === ADMIN_SECRET) {
      setAdminAuthed(true);
      loadAdminMeets();
    } else {
      setAdminError("Wrong password.");
    }
  }

  async function handleHostSubmit(e) {
    e.preventDefault();
    setHostSubmitting(true);
    setHostError("");
    try {
      let photoUrl = "";
      // Upload photo if a file was selected
      if (hostPhotoFile) {
        setHostPhotoUploading(true);
        const ext = hostPhotoFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("meet-photos")
          .upload(fileName, hostPhotoFile, { contentType: hostPhotoFile.type });
        if (uploadError) throw new Error("Photo upload failed: " + uploadError.message);
        const { data: urlData } = supabase.storage.from("meet-photos").getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
        setHostPhotoUploading(false);
      }
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
          photo_url: photoUrl,
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setHostSuccess(true);
      setHostTitle(""); setHostCity(""); setHostLocation("");
      setHostName(""); setHostContact(""); setHostDate("");
      setHostTime(""); setHostDescription(""); setHostPhoto("");
      setHostPhotoFile(null); setHostPhotoPreview("");
      setHostEventType("Cars & Coffee");
    } catch (err) {
      setHostError("Something went wrong. Please try again.");
    } finally {
      setHostSubmitting(false);
    }
  }

  const inp = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9" };
  const inpSm = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#FAFAF9", outline: "none" };
  const lbl = { fontSize: 12, color: "#999", display: "block", marginBottom: 6 };

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {showAuth && <AuthModal initialTab={authTab} onClose={() => setShowAuth(false)} onAuth={(u) => setUser(u)} />}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, select, button, textarea { font-family: inherit; }
        ::placeholder { color: #bbb; }
        .meet-card { transition: all 0.18s ease; }
        .meet-card:hover { border-color: #d0d0cc !important; box-shadow: 0 4px 24px rgba(0,0,0,0.07) !important; transform: translateY(-1px); }
        .chip:hover { border-color: #1a1a1a !important; color: #1a1a1a !important; }
        .nav-link:hover { color: #1a1a1a !important; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "relative" }}>
          <button onClick={clearAll} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </button>
          <nav style={{ display: "flex", gap: 28, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            {["Events", "Submit Event", "About"].map((l) => (
              <a key={l} className="nav-link" href="#" style={{ fontSize: 14, color: "#888", textDecoration: "none", transition: "color 0.15s" }}>{l}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {user ? (
              <>
                <span style={{ fontSize: 13, color: "#888" }}>{user.email?.split("@")[0]}</span>
                <button onClick={() => supabase.auth.signOut()}
                  style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "#555", cursor: "pointer" }}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setAuthTab("signin"); setShowAuth(true); }}
                  style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "#555", cursor: "pointer" }}>
                  Sign in
                </button>
                <button onClick={() => { setAuthTab("signup"); setShowAuth(true); }}
                  style={{ background: "#1a1a1a", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "white", fontWeight: 500, cursor: "pointer" }}>
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ position: "relative", height: 480, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/hero.jpg')", backgroundSize: "cover", backgroundPosition: "center 45%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.35) 50%, rgba(250,250,249,0.9) 90%, #FAFAF9 100%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 32px" }}>
          <h1 style={{ fontSize: 56, fontWeight: 300, lineHeight: 1.08, letterSpacing: "-0.02em", margin: 0, color: "white", textShadow: "0 2px 24px rgba(0,0,0,0.35)" }}>
            Find <span style={{ fontWeight: 700 }}>car meets</span> near you.
          </h1>
        </div>
      </section>

      {/* SEARCH PANEL */}
      <section style={{ background: "#FAFAF9", padding: "0 32px 48px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Toggle */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#E8E8E4", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <button onClick={() => setMode("find")}
              style={{ background: mode === "host" ? "white" : "#1a1a1a", border: "none", padding: "18px 24px", textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontSize: 11, color: mode === "host" ? "#aaa" : "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>I want to</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: mode === "host" ? "#1a1a1a" : "white" }}>Find a Meet</div>
            </button>
            <button onClick={() => setMode("host")}
              style={{ background: mode === "host" ? "#1a1a1a" : "white", border: "none", padding: "18px 24px", textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontSize: 11, color: mode === "host" ? "rgba(255,255,255,0.6)" : "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>I want to</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: mode === "host" ? "white" : "#1a1a1a" }}>Host a Meet</div>
            </button>
          </div>

          {/* Card */}
          <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 16, padding: 28, boxShadow: "0 2px 24px rgba(0,0,0,0.05)" }}>
            {mode !== "host" ? (
              <form onSubmit={handleSearch}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>City or zip code</label>
                    <input value={location} onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Norfolk, VA or 23510"
                      style={{ ...inp, fontSize: 15 }} />
                  </div>
                  <button type="submit"
                    style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", height: 46 }}>
                    Search Meets
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: "#aaa", marginRight: 4 }}>Radius:</span>
                  {RADII.map((r) => (
                    <button key={r} type="button" onClick={() => setRadius(r)} className="chip"
                      style={{ border: `1.5px solid ${radius === r ? "#1a1a1a" : "#E8E8E4"}`, background: radius === r ? "#1a1a1a" : "white", color: radius === r ? "white" : "#777", borderRadius: 100, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>
                      {r}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowFilters(!showFilters)}
                  style={{ background: "none", border: "none", fontSize: 13, color: "#aaa", cursor: "pointer", padding: 0 }}>
                  {showFilters ? "- Hide filters" : "+ More filters"}
                </button>
                {showFilters && (
                  <div style={{ borderTop: "1px solid #F0EFEB", paddingTop: 16, marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl}>Event type</label>
                      <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={inpSm}>
                        {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Date from</label>
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inpSm} />
                    </div>
                    <div>
                      <label style={lbl}>Date to</label>
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inpSm} />
                    </div>
                  </div>
                )}
              </form>
            ) : (
              <div>
                {!user ? (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Sign in to host a meet</div>
                    <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Create an account to submit your meet for review.</div>
                    <button onClick={() => setShowAuth(true)}
                      style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
                      Sign in / Sign up
                    </button>
                  </div>
                ) : hostSuccess ? (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>&#127881;</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Meet submitted for review!</div>
                    <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>We will review your meet and approve it shortly.</div>
                    <button onClick={() => setHostSuccess(false)}
                      style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
                      Submit another meet
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleHostSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={lbl}>Event title *</label>
                        <input required value={hostTitle} onChange={(e) => setHostTitle(e.target.value)}
                          placeholder="e.g. Sunday Morning Cars and Coffee" style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>City *</label>
                        <input required value={hostCity} onChange={(e) => setHostCity(e.target.value)}
                          placeholder="e.g. Norfolk" style={inp} />
                      </div>
                      <div style={{ gridColumn: "2 / -1" }}>
                        <label style={lbl}>Location / venue</label>
                        <input value={hostLocation} onChange={(e) => setHostLocation(e.target.value)}
                          placeholder="e.g. Waterside District" style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Host name *</label>
                        <input required value={hostName} onChange={(e) => setHostName(e.target.value)}
                          placeholder="Your name or group" style={inp} />
                      </div>
                      <div style={{ gridColumn: "2 / -1" }}>
                        <label style={lbl}>Contact (Instagram, phone, etc)</label>
                        <input value={hostContact} onChange={(e) => setHostContact(e.target.value)}
                          placeholder="e.g. @yourhandle" style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Date *</label>
                        <input required type="date" value={hostDate} onChange={(e) => setHostDate(e.target.value)} style={inpSm} />
                      </div>
                      <div>
                        <label style={lbl}>Time *</label>
                        <input required type="time" value={hostTime} onChange={(e) => setHostTime(e.target.value)} style={inpSm} />
                      </div>
                      <div>
                        <label style={lbl}>Event type *</label>
                        <select required value={hostEventType} onChange={(e) => setHostEventType(e.target.value)} style={inpSm}>
                          {EVENT_TYPES.slice(1).map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={lbl}>Photo / Flyer <span style={{ color: "#bbb" }}>(optional)</span></label>
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        border: `2px dashed ${hostPhotoPreview ? "#1a1a1a" : "#E8E8E4"}`, borderRadius: 8,
                        padding: hostPhotoPreview ? 0 : "24px 16px", cursor: "pointer",
                        background: "#FAFAF9", overflow: "hidden", minHeight: hostPhotoPreview ? 160 : "auto",
                        position: "relative",
                      }}>
                        <input type="file" accept="image/*" style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setHostPhotoFile(file);
                            setHostPhotoPreview(URL.createObjectURL(file));
                          }} />
                        {hostPhotoPreview ? (
                          <>
                            <img src={hostPhotoPreview} alt="preview"
                              style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                            <div style={{
                              position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)",
                              color: "white", fontSize: 11, padding: "4px 10px", borderRadius: 6,
                            }}>
                              Click to change
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>📷</div>
                            <div style={{ fontSize: 13, color: "#888", textAlign: "center" }}>
                              Click to upload a photo or flyer
                            </div>
                            <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>JPG, PNG, WebP up to 5MB</div>
                          </>
                        )}
                      </label>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={lbl}>Description</label>
                      <textarea value={hostDescription} onChange={(e) => setHostDescription(e.target.value)}
                        placeholder="Tell people about your meet..." rows={3}
                        style={{ ...inp, resize: "vertical" }} />
                    </div>
                    {hostError && (
                      <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 12 }}>
                        {hostError}
                      </div>
                    )}
                    <button type="submit" disabled={hostSubmitting}
                      style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: hostSubmitting ? "not-allowed" : "pointer", opacity: hostSubmitting ? 0.7 : 1 }}>
                      {hostSubmitting ? (hostPhotoUploading ? "Uploading photo..." : "Submitting...") : "Submit for Review"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 40, marginTop: 28, paddingLeft: 4 }}>
            {[["248", "Active meets"], ["34", "Cities"], ["12k", "Enthusiasts"]].map(([num, label]) => (
              <div key={label}>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{num}</div>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS */}
      {mode === "find" && (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 64px" }}>
          <div style={{ borderTop: "1px solid #ECEAE6", paddingTop: 40, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              {loading ? "Loading meets..." : `${filtered.length} meet${filtered.length === 1 ? "" : "s"} found`}
            </h2>
            <button onClick={clearAll} style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
              Clear search
            </button>
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 18px", fontSize: 14, color: "#991B1B", marginBottom: 24 }}>
              Could not load meets: {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 220, borderRadius: 12, background: "#F0EFEB" }} />
            ))}
            {!loading && !error && paged.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 15 }}>
                No meets found. Try a different city or expand your radius.
              </div>
            )}
            {!loading && !error && paged.map((m) => {
              const gradients = {
                "Cars & Coffee": "linear-gradient(135deg, #2c1810 0%, #6b3a2a 50%, #c4763a 100%)",
                "Cruise":        "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
                "Night Meet":    "linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)",
                "Show":          "linear-gradient(135deg, #1a1a1a 0%, #3d2b1f 50%, #7c4a2d 100%)",
                "Track Day":     "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #555 100%)",
              };
              const fallback = gradients[m.event_type] || "linear-gradient(135deg, #1a1a1a, #444)";
              return (
              <article key={m.id} className="meet-card"
                style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, overflow: "hidden", cursor: "pointer" }}>
                {/* Banner */}
                <div style={{
                  height: 160,
                  backgroundImage: m.photo_url ? `url(${m.photo_url})` : fallback,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }} />
                <div style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, background: "#F5F5F3", color: "#777", padding: "4px 10px", borderRadius: 100 }}>
                      {m.event_type || "Meet"}
                    </span>
                    <span style={{ fontSize: 12, color: "#aaa" }}>{formatDatePretty(m.date)}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>{m.title || "Untitled Meet"}</h3>
                  <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>&#128205; {m.city || "Location TBD"}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F0EFEB", paddingTop: 14 }}>
                    <span style={{ fontSize: 13, color: "#888" }}>by {m.host_name || "Anonymous"}</span>
                    <a href={`${API_BASE}/meets/${m.id}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", textDecoration: "none" }}>
                      Details
                    </a>
                  </div>
                </div>
              </article>
              );
            })}
          </div>

          {!loading && !error && filtered.length > PAGE_SIZE && (
            <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 8 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe === 1}
                style={{ border: "1.5px solid #E8E8E4", background: "white", borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer", opacity: pageSafe === 1 ? 0.4 : 1 }}>
                Prev
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  style={{ border: "1.5px solid", borderColor: pageSafe === i + 1 ? "#1a1a1a" : "#E8E8E4", background: pageSafe === i + 1 ? "#1a1a1a" : "white", color: pageSafe === i + 1 ? "white" : "#1a1a1a", borderRadius: 8, width: 36, height: 36, fontSize: 14, cursor: "pointer" }}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}
                style={{ border: "1.5px solid #E8E8E4", background: "white", borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer", opacity: pageSafe === totalPages ? 0.4 : 1 }}>
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {/* ADMIN PANEL */}
      {mode === "admin" && (
        <section style={{ maxWidth: 860, margin: "0 auto", padding: "40px 32px 64px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Admin — Pending Meets</h2>
            {adminAuthed && (
              <button onClick={loadAdminMeets}
                style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                Refresh
              </button>
            )}
          </div>

          {!adminAuthed ? (
            <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 16, padding: 32, maxWidth: 360 }}>
              <p style={{ fontSize: 13, color: "#888", marginTop: 0, marginBottom: 20 }}>Enter your admin password to continue.</p>
              <form onSubmit={handleAdminLogin}>
                <label style={lbl}>Password</label>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Admin secret" style={{ ...inp, marginBottom: 12 }} />
                {adminError && <div style={{ fontSize: 13, color: "#991B1B", marginBottom: 10 }}>{adminError}</div>}
                <button type="submit"
                  style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "11px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                  Login
                </button>
              </form>
            </div>
          ) : (
            <div>
              {adminActionMsg && (
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#166534", marginBottom: 16 }}>
                  {adminActionMsg}
                </div>
              )}
              {adminError && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
                  {adminError}
                </div>
              )}
              {adminLoading && <p style={{ color: "#aaa", fontSize: 14 }}>Loading...</p>}
              {!adminLoading && adminMeets.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 15 }}>
                  🎉 No pending meets — all caught up!
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {adminMeets.map((m) => (
                  <div key={m.id} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, background: "#F5F5F3", color: "#777", padding: "3px 10px", borderRadius: 100 }}>{m.event_type || "Meet"}</span>
                        <span style={{ fontSize: 12, color: "#aaa" }}>{formatDatePretty(m.date)}{m.time ? ` · ${m.time}` : ""}</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 3 }}>{m.title || "Untitled"}</div>
                      <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>📍 {m.city || "—"}{m.location ? ` · ${m.location}` : ""}</div>
                      <div style={{ fontSize: 13, color: "#888", marginBottom: m.description ? 8 : 0 }}>by {m.host_name || "Anonymous"}{m.host_contact ? ` · ${m.host_contact}` : ""}</div>
                      {m.description && <div style={{ fontSize: 13, color: "#555", borderTop: "1px solid #F0EFEB", paddingTop: 8, marginTop: 4 }}>{m.description}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, shrink: 0 }}>
                      <button onClick={() => adminUpdateStatus(m.id, "approved")}
                        style={{ background: "#16A34A", color: "white", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                        ✓ Approve
                      </button>
                      <button onClick={() => adminUpdateStatus(m.id, "rejected")}
                        style={{ background: "white", color: "#DC2626", border: "1.5px solid #FCA5A5", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #ECEAE6", padding: 32, background: "#FAFAF9" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", fontSize: 13, color: "#aaa" }}>
          <span>&#169; {new Date().getFullYear()} Cruiser</span>
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

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
