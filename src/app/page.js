"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const API = "https://cruiser-backend.onrender.com";

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── MeetCard ─────────────────────────────────────────────────────────────────
function MeetCard({ meet }) {
  const date = new Date(meet.date + "T00:00:00");
  const monthStr = date.toLocaleDateString("en-US", { month: "short" });
  const dayStr = date.toLocaleDateString("en-US", { day: "numeric" });

  return (
    <Link href={`/meets/${meet.id}`} className="meet-card">
      <div className="meet-card-photo">
        {meet.photo_url ? (
          <img src={meet.photo_url} alt={meet.title} />
        ) : (
          <div className="meet-card-photo-placeholder" />
        )}
        <div className="meet-card-date-badge">
          <span className="badge-month">{monthStr}</span>
          <span className="badge-day">{dayStr}</span>
        </div>
        {meet.event_type && (
          <span className="meet-card-type">{meet.event_type}</span>
        )}
      </div>
      <div className="meet-card-body">
        <h3 className="meet-card-title">{meet.title}</h3>
        <p className="meet-card-location">
          {meet.city}, {meet.state}
        </p>
        <p className="meet-card-time">{meet.time}</p>
        <p className="meet-card-host">Hosted by {meet.host_name}</p>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [allMeets, setAllMeets] = useState([]);
  const [displayedMeets, setDisplayedMeets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filter inputs — these do NOT trigger live filtering
  const [cityInput, setCityInput] = useState("");
  const [radiusInput, setRadiusInput] = useState("25");
  const [typeInput, setTypeInput] = useState("");
  const [dateInput, setDateInput] = useState("");

  // Auth / admin state
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Stats
  const [stats, setStats] = useState({ meets: 0, cities: 0, rsvps: 0 });

  // ── Load approved meets on mount ──────────────────────────────────────────
  useEffect(() => {
    async function loadMeets() {
      setLoading(true);
      const { data, error } = await supabase
        .from("meets")
        .select("*")
        .eq("status", "approved")
        .order("date", { ascending: true });
      if (!error && data) {
        setAllMeets(data);
        setDisplayedMeets(data);
        // Real stats
        const uniqueCities = new Set(data.map((m) => m.city)).size;
        setStats({ meets: data.length, cities: uniqueCities, rsvps: "—" });
      }
      setLoading(false);
    }
    loadMeets();
  }, []);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      checkAdmin(session?.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        checkAdmin(session?.user);
      }
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  async function checkAdmin(u) {
    if (!u) return setIsAdmin(false);
    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", u.id)
      .single();
    setIsAdmin(data?.is_admin ?? false);
  }

  // ── Search — the ONLY thing that filters ─────────────────────────────────
  async function handleSearch(e) {
    e.preventDefault();
    setSearching(true);
    setHasSearched(true);

    try {
      let results = [...allMeets];

      // Date filter
      if (dateInput) {
        results = results.filter((m) => m.date >= dateInput);
      }

      // Event type filter
      if (typeInput) {
        results = results.filter(
          (m) => m.event_type?.toLowerCase() === typeInput.toLowerCase()
        );
      }

      // City + radius filter (requires geocoding)
      if (cityInput.trim()) {
        const geoResp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            cityInput.trim()
          )}&format=json&limit=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const geoData = await geoResp.json();

        if (geoData.length > 0) {
          const { lat, lon } = geoData[0];
          const centerLat = parseFloat(lat);
          const centerLng = parseFloat(lon);
          const radiusMi = parseFloat(radiusInput) || 25;

          results = results.filter((m) => {
            if (!m.lat || !m.lng) return false;
            return haversine(centerLat, centerLng, m.lat, m.lng) <= radiusMi;
          });
        } else {
          // Geocode failed — fall back to text match on city name
          const q = cityInput.trim().toLowerCase();
          results = results.filter((m) => m.city?.toLowerCase().includes(q));
        }
      }

      setDisplayedMeets(results);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  }

  function handleClear() {
    setCityInput("");
    setRadiusInput("25");
    setTypeInput("");
    setDateInput("");
    setHasSearched(false);
    setDisplayedMeets(allMeets);
  }

  // ── Admin helpers ──────────────────────────────────────────────────────────
  async function approveMeet(id) {
    await supabase.from("meets").update({ status: "approved" }).eq("id", id);
    setAllMeets((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "approved" } : m))
    );
  }
  async function rejectMeet(id) {
    await supabase.from("meets").update({ status: "rejected" }).eq("id", id);
    setAllMeets((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "rejected" } : m))
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1a1a;
          --bg: #FAFAF9;
          --border: #E8E8E4;
          --white: #ffffff;
          --muted: #6b6b6b;
          --accent: #1a1a1a;
          --radius: 10px;
        }
        html { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--ink); }
        body { min-height: 100vh; }
        a { text-decoration: none; color: inherit; }
        button { cursor: pointer; font-family: inherit; }

        /* NAV */
        .nav {
          position: sticky; top: 0; z-index: 100;
          background: var(--white); border-bottom: 1px solid var(--border);
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .nav-logo { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
        .nav-links { display: flex; gap: 28px; align-items: center; }
        .nav-links a { font-size: 14px; color: var(--muted); transition: color .15s; }
        .nav-links a:hover { color: var(--ink); }
        .nav-actions { display: flex; gap: 10px; align-items: center; }
        .btn { display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 8px; padding: 8px 16px; font-size: 14px; font-weight: 500; transition: opacity .15s; }
        .btn:hover { opacity: .85; }
        .btn-primary { background: var(--ink); color: var(--white); }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--ink); }
        .btn-sm { padding: 6px 12px; font-size: 13px; }

        /* HERO */
        .hero { padding: 64px 24px 48px; max-width: 680px; margin: 0 auto; text-align: center; }
        .hero h1 { font-size: clamp(32px, 5vw, 52px); font-weight: 700; letter-spacing: -1.5px; line-height: 1.1; margin-bottom: 16px; }
        .hero p { font-size: 17px; color: var(--muted); line-height: 1.6; margin-bottom: 40px; }

        /* STATS */
        .stats { display: flex; gap: 0; justify-content: center; border: 1px solid var(--border); border-radius: var(--radius); background: var(--white); max-width: 420px; margin: 0 auto 48px; overflow: hidden; }
        .stat { flex: 1; padding: 20px; text-align: center; }
        .stat + .stat { border-left: 1px solid var(--border); }
        .stat-num { font-size: 26px; font-weight: 700; letter-spacing: -1px; }
        .stat-label { font-size: 12px; color: var(--muted); margin-top: 2px; text-transform: uppercase; letter-spacing: .5px; }

        /* SEARCH FORM */
        .search-section { max-width: 800px; margin: 0 auto 56px; padding: 0 24px; }
        .search-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
        .search-row { display: grid; grid-template-columns: 1fr 100px 140px 140px; gap: 10px; align-items: end; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 12px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
        .field input, .field select { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; font-family: inherit; background: var(--bg); color: var(--ink); outline: none; transition: border-color .15s; }
        .field input:focus, .field select:focus { border-color: var(--ink); }
        .search-hint { font-size: 12px; color: var(--muted); margin-top: 12px; }

        /* MEETS GRID */
        .meets-section { max-width: 1100px; margin: 0 auto; padding: 0 24px 80px; }
        .meets-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .meets-header h2 { font-size: 20px; font-weight: 600; letter-spacing: -.3px; }
        .meets-count { font-size: 13px; color: var(--muted); }
        .meets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .empty-state { text-align: center; padding: 80px 0; color: var(--muted); }
        .empty-state p { font-size: 15px; }

        /* MEET CARD */
        .meet-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: transform .15s, box-shadow .15s; display: block; }
        .meet-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.07); }
        .meet-card-photo { position: relative; height: 180px; background: var(--border); overflow: hidden; }
        .meet-card-photo img { width: 100%; height: 100%; object-fit: cover; }
        .meet-card-photo-placeholder { width: 100%; height: 100%; background: var(--border); }
        .meet-card-date-badge { position: absolute; top: 12px; left: 12px; background: var(--white); border-radius: 8px; padding: 6px 10px; text-align: center; min-width: 44px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
        .badge-month { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
        .badge-day { display: block; font-size: 20px; font-weight: 700; line-height: 1; }
        .meet-card-type { position: absolute; top: 12px; right: 12px; background: var(--ink); color: var(--white); font-size: 11px; font-weight: 500; padding: 4px 8px; border-radius: 6px; text-transform: capitalize; }
        .meet-card-body { padding: 16px; }
        .meet-card-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; letter-spacing: -.2px; }
        .meet-card-location { font-size: 13px; color: var(--muted); margin-bottom: 3px; }
        .meet-card-time { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
        .meet-card-host { font-size: 12px; color: var(--muted); }

        /* HOST CTA */
        .host-cta { background: var(--ink); color: var(--white); border-radius: var(--radius); padding: 40px 32px; max-width: 1100px; margin: 0 auto 80px; padding-left: calc(32px + 24px); padding-right: calc(32px + 24px); display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .host-cta h2 { font-size: 22px; font-weight: 700; letter-spacing: -.5px; margin-bottom: 6px; }
        .host-cta p { font-size: 15px; opacity: .7; }
        .btn-white { background: var(--white); color: var(--ink); white-space: nowrap; padding: 10px 20px; }

        /* ADMIN */
        .admin-panel { max-width: 1100px; margin: 0 auto 80px; padding: 0 24px; }
        .admin-panel h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
        .admin-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--white); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; gap: 12px; }
        .admin-row-info { flex: 1; }
        .admin-row-title { font-size: 14px; font-weight: 500; }
        .admin-row-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .admin-actions { display: flex; gap: 8px; }
        .btn-approve { background: #f0faf4; color: #1a6b3a; border: 1px solid #c3e6cb; }
        .btn-reject { background: #fff5f5; color: #c0392b; border: 1px solid #f5c6cb; }

        /* MOBILE */
        @media (max-width: 640px) {
          .nav-links { display: none; }
          .search-row { grid-template-columns: 1fr; }
          .hero { padding: 40px 20px 32px; }
          .host-cta { flex-direction: column; text-align: center; margin: 0 24px 60px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <span className="nav-logo">Cruiser</span>
        <div className="nav-links">
          <Link href="/events">Events</Link>
          <Link href="/submit">Submit Event</Link>
          <Link href="/about">About</Link>
          {user && <Link href="/my-submissions">My Submissions</Link>}
        </div>
        <div className="nav-actions">
          {user ? (
            <>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {user.email}
              </span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setAuthModalOpen(true)}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <h1>Find your next car meet</h1>
        <p>
          Discover local meets, shows, and cruises near you. Join the
          community.
        </p>

        <div className="stats">
          <div className="stat">
            <div className="stat-num">{stats.meets}</div>
            <div className="stat-label">Meets</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.cities}</div>
            <div className="stat-label">Cities</div>
          </div>
          <div className="stat">
            <div className="stat-num">—</div>
            <div className="stat-label">RSVPs</div>
          </div>
        </div>
      </section>

      {/* SEARCH */}
      <section className="search-section">
        <div className="search-card">
          <form onSubmit={handleSearch}>
            <div className="search-row">
              <div className="field">
                <label>City or area</label>
                <input
                  type="text"
                  placeholder="Norfolk, VA Beach..."
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Radius</label>
                <select
                  value={radiusInput}
                  onChange={(e) => setRadiusInput(e.target.value)}
                >
                  <option value="10">10 mi</option>
                  <option value="25">25 mi</option>
                  <option value="50">50 mi</option>
                  <option value="100">100 mi</option>
                </select>
              </div>
              <div className="field">
                <label>Type</label>
                <select
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                >
                  <option value="">All types</option>
                  <option value="casual">Casual</option>
                  <option value="show">Show</option>
                  <option value="cruise">Cruise</option>
                  <option value="track">Track</option>
                  <option value="registration">Registration</option>
                </select>
              </div>
              <div className="field">
                <label>From date</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                />
              </div>
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={searching}
              >
                {searching ? "Searching..." : "Search"}
              </button>
              {hasSearched && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
            </div>
            <p className="search-hint">
              Enter a city and hit Search to apply radius filtering. Leave
              blank to browse all meets.
            </p>
          </form>
        </div>
      </section>

      {/* MEETS */}
      <section className="meets-section">
        <div className="meets-header">
          <h2>{hasSearched ? "Search results" : "Upcoming meets"}</h2>
          <span className="meets-count">{displayedMeets.length} meets</span>
        </div>
        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading...</p>
        ) : displayedMeets.length === 0 ? (
          <div className="empty-state">
            <p>No meets found. Try a different location or clear filters.</p>
          </div>
        ) : (
          <div className="meets-grid">
            {displayedMeets.map((meet) => (
              <MeetCard key={meet.id} meet={meet} />
            ))}
          </div>
        )}
      </section>

      {/* HOST CTA */}
      <div style={{ padding: "0 24px" }}>
        <div className="host-cta">
          <div>
            <h2>Hosting a meet?</h2>
            <p>Submit your event and reach the community.</p>
          </div>
          <Link href="/submit" className="btn btn-white">
            Submit a meet
          </Link>
        </div>
      </div>

      {/* ADMIN PANEL */}
      {isAdmin && (
        <section className="admin-panel">
          <h2>Admin — Pending meets</h2>
          <AdminPanel
            allMeets={allMeets}
            onApprove={approveMeet}
            onReject={rejectMeet}
          />
        </section>
      )}
    </>
  );
}

function AdminPanel({ allMeets, onApprove, onReject }) {
  const pending = allMeets.filter((m) => m.status === "pending");
  if (pending.length === 0)
    return (
      <p style={{ fontSize: 14, color: "var(--muted)" }}>No pending meets.</p>
    );
  return (
    <>
      {pending.map((m) => (
        <div key={m.id} className="admin-row">
          <div className="admin-row-info">
            <div className="admin-row-title">{m.title}</div>
            <div className="admin-row-sub">
              {m.city}, {m.state} &middot; {m.date} &middot; {m.host_name}
            </div>
          </div>
          <div className="admin-actions">
            <button
              className="btn btn-sm btn-approve"
              onClick={() => onApprove(m.id)}
            >
              Approve
            </button>
            <button
              className="btn btn-sm btn-reject"
              onClick={() => onReject(m.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
