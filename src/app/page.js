"use client";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
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

// Haversine formula — returns distance in miles between two lat/lon points
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode a city string to {lat, lon} using Nominatim
async function geocodeCity(city) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&countrycodes=us`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (e) { console.error("Geocode error:", e); }
  return null;
}

function HomeInner() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [profileUsername, setProfileUsername] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState("signin");
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(() => searchParams.get("admin") === "true" ? "admin" : "find");

  const [location, setLocation] = useState("");
  const [locationState, setLocationState] = useState("");
  const [detectedLocation, setDetectedLocation] = useState(""); // confirmed geocode result
  const [showFilters, setShowFilters] = useState(false);
  const [eventType, setEventType] = useState("All Types");
  const [radius, setRadius] = useState("25 mi");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchCoords, setSearchCoords] = useState(null); // {lat, lon} of searched location

  // Committed filter values — only update when user hits Search/Enter
  const [committedLocation, setCommittedLocation] = useState("");
  const [committedEventType, setCommittedEventType] = useState("All Types");
  const [committedDateFrom, setCommittedDateFrom] = useState("");
  const [committedDateTo, setCommittedDateTo] = useState("");
  const [committedSearchCoords, setCommittedSearchCoords] = useState(null);
  const [meetCoords, setMeetCoords] = useState({}); // {meetId: {lat, lon}}
  const [geoLoading, setGeoLoading] = useState(false);

  const [hostTitle, setHostTitle] = useState("");
  const [hostCity, setHostCity] = useState("");
  const [hostState, setHostState] = useState("");
  const [hostLocation, setHostLocation] = useState("");
  const [hostAddressInput, setHostAddressInput] = useState("");
  const [hostAddressSuggestions, setHostAddressSuggestions] = useState([]);
  const [hostAddressLoading, setHostAddressLoading] = useState(false);
  const [hostAddressSelected, setHostAddressSelected] = useState(false);
  const [hostLat, setHostLat] = useState(null);
  const [hostLng, setHostLng] = useState(null);
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

  // Responsive
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileUsername(session.access_token);
        checkAndRedirectToSetup(session.access_token);
      }
    });
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileUsername(session.access_token);
        checkAndRedirectToSetup(session.access_token);
      } else setProfileUsername(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkAndRedirectToSetup(token) {
    try {
      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const p = await res.json();
        if (!p?.username) window.location.href = "/profile/setup";
      } else {
        window.location.href = "/profile/setup";
      }
    } catch { /* silent */ }
  }

  async function fetchProfileUsername(token) {
    try {
      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const p = await res.json();
        if (p?.username) setProfileUsername(p.username);
      }
    } catch (e) { /* silent */ }
  }

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
    if (committedLocation.trim()) {
      if (committedSearchCoords) {
        // Radius-based filtering using stored lat/lng on each meet
        const radiusMiles = parseInt(radius) || 25;
        list = list.filter((m) => {
          if (m.lat && m.lng) {
            return haversineDistance(committedSearchCoords.lat, committedSearchCoords.lon, m.lat, m.lng) <= radiusMiles;
          }
          // Fallback to city text match for meets without coordinates
          return (m.city || "").toLowerCase().includes(committedLocation.trim().toLowerCase());
        });
      } else {
        // No geocode result yet — fallback to text match
        const needle = committedLocation.trim().toLowerCase();
        list = list.filter((m) =>
          `${m.city || ""} ${m.state || ""} ${m.title || ""}`.toLowerCase().includes(needle)
        );
      }
    }
    if (committedEventType !== "All Types") {
      list = list.filter((m) => (m.event_type || "").toLowerCase() === committedEventType.toLowerCase());
    }
    if (committedDateFrom) list = list.filter((m) => (m.date || "") >= committedDateFrom);
    if (committedDateTo) list = list.filter((m) => (m.date || "") <= committedDateTo);
    return list;
  }, [meets, committedLocation, committedSearchCoords, radius, committedEventType, committedDateFrom, committedDateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  useEffect(() => { setPage(1); }, [committedLocation, committedEventType, committedDateFrom, committedDateTo]);

  async function handleSearch(e) {
    e.preventDefault();
    setMode("find");
    setSearched(true);
    // Commit all filter values so filtering only happens on submit
    setCommittedEventType(eventType);
    setCommittedDateFrom(dateFrom);
    setCommittedDateTo(dateTo);
    const query = [location.trim(), locationState.trim()].filter(Boolean).join(", ");
    if (query) {
      setGeoLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        if (data && data[0]) {
          const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
          setSearchCoords(coords);
          setCommittedSearchCoords(coords);
          const parts = (data[0].display_name || "").split(",");
          setDetectedLocation(parts.slice(0, 2).join(",").trim());
        } else {
          setSearchCoords(null);
          setCommittedSearchCoords(null);
          setDetectedLocation("");
        }
      } catch (e) {
        console.error("Geocode error:", e);
        setSearchCoords(null);
        setCommittedSearchCoords(null);
      } finally {
        setCommittedLocation(location);
        setGeoLoading(false);
      }
    } else {
      setSearchCoords(null);
      setCommittedSearchCoords(null);
      setCommittedLocation(location);
    }
  }

  function clearAll() {
    setLocation("");
    setLocationState("");
    setDetectedLocation("");
    setEventType("All Types");
    setRadius("25 mi");
    setDateFrom("");
    setDateTo("");
    setSearched(false);
    setSearchCoords(null);
    // Reset committed state too
    setCommittedLocation("");
    setCommittedEventType("All Types");
    setCommittedDateFrom("");
    setCommittedDateTo("");
    setCommittedSearchCoords(null);
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


  // Address autocomplete using Nominatim
  function handleAddressInputChange(val) {
    setHostAddressInput(val);
    setHostAddressSelected(false);
    setHostLat(null);
    setHostLng(null);
    if (hostAddressDebounceRef.current) clearTimeout(hostAddressDebounceRef.current);
    if (val.trim().length < 5) { setHostAddressSuggestions([]); return; }
    hostAddressDebounceRef.current = setTimeout(async () => {
      setHostAddressLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=us&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setHostAddressSuggestions(data || []);
      } catch (e) {
        setHostAddressSuggestions([]);
      } finally {
        setHostAddressLoading(false);
      }
    }, 400);
  }

  function handleAddressSelect(suggestion) {
    const addr = suggestion.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || "";
    const state = addr.state || "";
    const display = suggestion.display_name || "";
    setHostAddressInput(display.split(",").slice(0, 3).join(",").trim());
    setHostLocation(display);
    setHostCity(city);
    setHostState(state);
    setHostLat(parseFloat(suggestion.lat));
    setHostLng(parseFloat(suggestion.lon));
    setHostAddressSuggestions([]);
    setHostAddressSelected(true);
  }

  async function handleHostSubmit(e) {
    e.preventDefault();
    // Require address to be selected from autocomplete
    if (!hostAddressSelected || !hostLat || !hostLng) {
      setHostError("Please select a valid address from the suggestions dropdown.");
      return;
    }
    setHostSubmitting(true);
    setHostError("");
    try {
      let photoUrl = "";
      // Require a photo
      if (!hostPhotoFile) {
        throw new Error("A photo or flyer is required. Please upload an image for your meet.");
      }
      // Upload photo
      if (hostPhotoFile) {
        setHostPhotoUploading(true);

        // Validate file type and size before uploading
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(hostPhotoFile.type)) {
          throw new Error("Photo upload failed: Only JPEG, PNG, WEBP, and GIF images are allowed.");
        }
        if (hostPhotoFile.size > 5 * 1024 * 1024) {
          throw new Error("Photo upload failed: Image must be under 5MB.");
        }

        const ext = hostPhotoFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        // Get current session to ensure auth token is fresh
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Photo upload failed: You must be signed in to upload a photo.");
        }

      // Use pre-selected lat/lng from address autocomplete
      const meetLat = hostLat;
      const meetLng = hostLng;

        const { error: uploadError } = await supabase.storage
          .from("meet-photos")
          .upload(fileName, hostPhotoFile, {
            contentType: hostPhotoFile.type,
            upsert: false,
          });
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
          state: hostState,
          location: hostLocation,
          host_name: hostName,
          host_contact: hostContact,
          date: hostDate,
          time: hostTime,
          event_type: hostEventType,
          description: hostDescription,
          photo_url: photoUrl,
          lat: meetLat,
          lng: meetLng,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error("Submission failed: " + (errBody?.error || res.status));
      }
      setHostSuccess(true);
      setHostTitle(""); setHostCity(""); setHostState(""); setHostLocation("");
      setHostAddressInput(""); setHostAddressSuggestions([]); setHostAddressSelected(false);
      setHostLat(null); setHostLng(null);
      setHostName(""); setHostContact(""); setHostDate("");
      setHostTime(""); setHostDescription(""); setHostPhoto("");
      setHostPhotoFile(null); setHostPhotoPreview("");
      setHostEventType("Cars & Coffee");
    } catch (err) {
      // Surface the real error message so it's visible in the UI
      setHostError(err?.message || "Something went wrong. Please try again.");
      console.error("[Cruiser] Host submit error:", err);
    } finally {
      setHostSubmitting(false);
      setHostPhotoUploading(false);
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
        .hamburger { display: none; background: none; border: none; cursor: pointer; padding: 4px; }
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
          .desktop-auth { display: none !important; }
          .hamburger { display: flex !important; align-items: center; justify-content: center; }
          .mobile-menu { position: absolute; top: 60px; left: 0; right: 0; background: #FAFAF9; border-bottom: 1px solid #ECEAE6; padding: 16px 24px; display: flex; flex-direction: column; gap: 0; z-index: 100; }
          .mobile-menu a, .mobile-menu button { font-size: 15px; padding: 14px 0; border-bottom: 1px solid #F0EFEB; text-align: left; background: none; border-left: none; border-right: none; border-top: none; cursor: pointer; color: #1a1a1a; text-decoration: none; font-family: inherit; }
          .mobile-menu button.primary { background: #1a1a1a; color: white; border-radius: 8px; padding: 12px 0; text-align: center; margin-top: 8px; border: none; font-weight: 500; }
        }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "relative" }}>
          {/* Logo */}
          <button onClick={clearAll} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, zIndex: 101 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </button>

          {/* Desktop center nav */}
          <nav className="desktop-nav" style={{ display: "flex", gap: 28, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            {["Events", "Submit Event", "About"].map((l) => (
              <a key={l} className="nav-link" href="#" style={{ fontSize: 14, color: "#888", textDecoration: "none", transition: "color 0.15s" }}>{l}</a>
            ))}
          </nav>

          {/* Desktop auth buttons */}
          <div className="desktop-auth" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {user ? (
              <>
                {profileUsername ? (
                  <a href={`/u/${profileUsername}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "7px 14px", fontSize: 13, color: "#555", cursor: "pointer" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1a1a1a", display: "grid", placeItems: "center", color: "white", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {profileUsername[0].toUpperCase()}
                    </div>
                    {profileUsername}
                  </a>
                ) : (
                  <a href="/profile/setup"
                    style={{ fontSize: 13, color: "#888", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "7px 14px", textDecoration: "none" }}>
                    Set up profile
                  </a>
                )}
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

          {/* Hamburger (mobile only) */}
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} style={{ zIndex: 101 }}
            aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              {menuOpen ? (
                <>
                  <line x1="4" y1="4" x2="18" y2="18" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="18" y1="4" x2="4" y2="18" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="19" y2="6" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3" y1="11" x2="19" y2="11" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3" y1="16" x2="19" y2="16" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="mobile-menu">
            <a href="#" onClick={() => setMenuOpen(false)}>Events</a>
            <a href="#" onClick={() => { setMode("host"); setMenuOpen(false); }}>Submit Event</a>
            <a href="#">About</a>
            {user ? (
              <>
                {profileUsername ? (
                  <a href={`/u/${profileUsername}`} onClick={() => setMenuOpen(false)}>👤 My Profile</a>
                ) : (
                  <a href="/profile/setup" onClick={() => setMenuOpen(false)}>Set up profile</a>
                )}
                <span style={{ fontSize: 13, color: "#888", padding: "14px 0", borderBottom: "1px solid #F0EFEB" }}>{user.email?.split("@")[0]}</span>
                <button onClick={() => { supabase.auth.signOut(); setMenuOpen(false); }}>Sign out</button>
              </>
            ) : (
              <>
                <button onClick={() => { setAuthTab("signin"); setShowAuth(true); setMenuOpen(false); }}>Sign in</button>
                <button className="primary" onClick={() => { setAuthTab("signup"); setShowAuth(true); setMenuOpen(false); }}>Sign up</button>
              </>
            )}
          </div>
        )}
      </header>

      {/* HERO */}
      <section style={{ position: "relative", height: isMobile ? 320 : 480, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/hero.jpg')", backgroundSize: "cover", backgroundPosition: "center 45%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.35) 50%, rgba(250,250,249,0.9) 90%, #FAFAF9 100%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 20px" }}>
          <h1 style={{ fontSize: isMobile ? 32 : 56, fontWeight: 300, lineHeight: 1.08, letterSpacing: "-0.02em", margin: 0, color: "white", textShadow: "0 2px 24px rgba(0,0,0,0.35)" }}>
            Find <span style={{ fontWeight: 700 }}>car meets</span> near you.
          </h1>
        </div>
      </section>

      {/* SEARCH PANEL */}
      <section style={{ background: "#FAFAF9", padding: isMobile ? "0 16px 32px" : "0 32px 48px" }}>
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
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>City or zip code</label>
                    <input value={location} onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Norfolk or 23510"
                      style={{ ...inp, fontSize: 15 }} />
                  </div>
                  <div>
                    <label style={lbl}>State <span style={{ color: "#ccc", fontWeight: 400 }}>(optional)</span></label>
                    <input value={locationState} onChange={(e) => setLocationState(e.target.value)}
                      placeholder="e.g. VA"
                      maxLength={20}
                      style={{ ...inp, fontSize: 15 }} />
                  </div>
                  <button type="submit" disabled={geoLoading}
                    style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: geoLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", height: 46, opacity: geoLoading ? 0.7 : 1 }}>
                    {geoLoading ? "Searching..." : "Search Meets"}
                  </button>
                </div>
                {detectedLocation && !geoLoading && (
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#22c55e" }}>📍</span>
                    Searching near <strong style={{ color: "#1a1a1a" }}>{detectedLocation}</strong>
                    <span style={{ color: "#bbb", margin: "0 4px" }}>·</span>
                    <span>{radius} radius</span>
                  </div>
                )}
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
                  <div style={{ borderTop: "1px solid #F0EFEB", paddingTop: 16, marginTop: 12, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}>
                        <label style={lbl}>Event title *</label>
                        <input required value={hostTitle} onChange={(e) => setHostTitle(e.target.value)}
                          placeholder="e.g. Sunday Morning Cars and Coffee" style={inp} />
                      </div>
                      <div style={{ gridColumn: isMobile ? "1" : "1 / -1", position: "relative" }}>
                        <label style={lbl}>Venue address * <span style={{ color: "#bbb", fontWeight: 400 }}>(start typing to search)</span></label>
                        <input
                          value={hostAddressInput}
                          onChange={(e) => handleAddressInputChange(e.target.value)}
                          placeholder="e.g. 333 Waterside Dr, Norfolk, VA"
                          style={{ ...inp, borderColor: hostAddressSelected ? "#22c55e" : hostAddressInput && !hostAddressSelected ? "#f59e0b" : "#E8E8E4" }}
                          autoComplete="off"
                        />
                        {hostAddressSelected && (
                          <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>✓ Address confirmed</div>
                        )}
                        {hostAddressInput && !hostAddressSelected && !hostAddressLoading && (
                          <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 4 }}>⚠ Please select an address from the dropdown</div>
                        )}
                        {hostAddressLoading && (
                          <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Searching...</div>
                        )}
                        {hostAddressSuggestions.length > 0 && (
                          <div style={{
                            position: "absolute", top: "100%", left: 0, right: 0, background: "white",
                            border: "1.5px solid #E8E8E4", borderRadius: 8, zIndex: 100,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto"
                          }}>
                            {hostAddressSuggestions.map((s, i) => (
                              <div key={i} onClick={() => handleAddressSelect(s)}
                                style={{
                                  padding: "10px 14px", fontSize: 13, cursor: "pointer",
                                  borderBottom: i < hostAddressSuggestions.length - 1 ? "1px solid #F0EFEB" : "none",
                                  color: "#1a1a1a"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#F5F5F3"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                              >
                                📍 {s.display_name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={lbl}>Host name *</label>
                        <input required value={hostName} onChange={(e) => setHostName(e.target.value)}
                          placeholder="Your name or group" style={inp} />
                      </div>
                      <div style={{ gridColumn: isMobile ? "1" : "2 / -1" }}>
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
                      <label style={lbl}>Photo / Flyer <span style={{ color: "#DC2626" }}>*</span></label>
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
          <div style={{ display: "flex", gap: isMobile ? 24 : 40, marginTop: 28, paddingLeft: 4 }}>
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
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "0 16px 48px" : "0 32px 64px" }}>
          <div style={{ borderTop: "1px solid #ECEAE6", paddingTop: 40, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              {loading ? "Loading meets..." : geoLoading ? "Searching nearby..." : `${filtered.length} meet${filtered.length === 1 ? "" : "s"} found`}
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
                    <a href={`/meets/${m.id}`}
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
