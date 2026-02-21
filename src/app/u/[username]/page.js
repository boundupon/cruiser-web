"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const MOD_CATEGORIES = [
  "Engine / Performance","Exhaust","Suspension","Wheels & Tires",
  "Exterior / Cosmetic","Interior","Audio","Tune / ECU","Wrap / Paint",
];

const SOCIAL_ICONS = {
  instagram: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
  youtube: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>,
  tiktok: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>,
  facebook: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
  website: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
};

function StarRating({ value }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, alignItems: "center" }}>
      {[1,2,3,4,5].map((s) => (
        <svg key={s} width="11" height="11" viewBox="0 0 24 24"
          fill={s <= Math.round(value) ? "#f59e0b" : "none"}
          stroke="#f59e0b" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
      <span style={{ fontSize: 12, color: "#888", marginLeft: 3 }}>{Number(value).toFixed(1)}</span>
    </span>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const username = params?.username;

  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [mods, setMods] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [lightboxPost, setLightboxPost] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setCurrentUser(session?.user ?? null));
  }, []);

  useEffect(() => {
    if (!username) return;
    async function load() {
      setLoading(true);
      try {
        const [pRes, mRes, postRes, vRes] = await Promise.all([
          fetch(`${API_BASE}/profiles/${username}`),
          fetch(`${API_BASE}/profiles/${username}/mods`),
          fetch(`${API_BASE}/profiles/${username}/posts`),
          fetch(`${API_BASE}/profiles/${username}/vehicles`),
        ]);
        if (pRes.status === 404) { setNotFound(true); return; }
        const [p, m, po, v] = await Promise.all([pRes.json(), mRes.json(), postRes.json(), vRes.json()]);
        setProfile(p);
        setMods(Array.isArray(m) ? m : []);
        setPosts(Array.isArray(po) ? po : []);
        const vList = Array.isArray(v) ? v : [];
        setVehicles(vList);
        const primary = vList.find((x) => x.is_primary) || vList[0];
        if (primary) setSelectedVehicleId(primary.id);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    }
    load();
  }, [username]);

  const isOwner = currentUser && profile && currentUser.id === profile.id;
  const socialLinks = Array.isArray(profile?.social_links) ? profile.social_links : [];
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const displayMods = mods.filter((m) => m.vehicle_id === selectedVehicleId);
  const modsByCategory = MOD_CATEGORIES.reduce((acc, cat) => {
    const items = displayMods.filter((m) => m.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  if (loading) return <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", color: "#bbb" }}>Loading...</div>;
  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Profile not found</div>
        <div style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>@{username} doesn't exist on Cruiser.</div>
        <a href="/" style={{ background: "#1a1a1a", color: "white", borderRadius: 8, padding: "10px 24px", fontSize: 14, textDecoration: "none", fontWeight: 500 }}>Back to home</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", fontFamily: "'DM Sans', -apple-system, sans-serif", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        .post-thumb { transition: opacity 0.15s; } .post-thumb:hover { opacity: 0.82; }
        .vehicle-chip { transition: all 0.15s; }
        .social-chip { transition: background 0.15s; }
        .social-chip:hover { background: #F0EFEB !important; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </a>
          {isOwner && (
            <a href={`/u/${username}/edit`} style={{ background: "#1a1a1a", color: "white", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>Edit Profile</a>
          )}
        </div>
      </header>

      {/* BANNER with identity overlay */}
      <div style={{
        height: isMobile ? 210 : 290,
        background: profile.banner_image_url ? `url(${profile.banner_image_url}) center/cover no-repeat` : "linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)",
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: isMobile ? "0 16px 20px" : "0 40px 26px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
            <div style={{
              width: isMobile ? 72 : 88, height: isMobile ? 72 : 88,
              borderRadius: 14, border: "3px solid rgba(255,255,255,0.18)",
              background: profile.profile_photo_url ? `url(${profile.profile_photo_url}) center/cover` : "#2a2a2a",
              display: "grid", placeItems: "center", fontSize: 28, color: "#666", flexShrink: 0,
            }}>
              {!profile.profile_photo_url && "👤"}
            </div>
            <div style={{ paddingBottom: 4 }}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 20 : 26, fontWeight: 800, color: "white", margin: "0 0 3px", lineHeight: 1.1 }}>
                {profile.display_name || profile.username}
              </h1>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                @{profile.username}{profile.city ? ` · ${[profile.city, profile.state].filter(Boolean).join(", ")}` : ""}
              </div>
            </div>
          </div>
          {!isOwner && (
            <button style={{ background: "white", color: "#1a1a1a", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, marginBottom: 4, fontFamily: "inherit" }}>
              Follow
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "0 16px 64px" : "0 40px 64px" }}>

        {/* STATS BAR */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(5, 1fr)`, border: "1.5px solid #E8E8E4", borderRadius: 12, overflow: "hidden", margin: "20px 0", background: "white" }}>
          {[
            { num: posts.length, label: "Posts" },
            { num: "0", label: "Followers" },
            { num: "0", label: "Following" },
            { num: profile.meets_hosted_count || 0, label: "Hosted" },
            { num: profile.host_rating ? `${Number(profile.host_rating).toFixed(1)}★` : "—", label: "Rating" },
          ].map(({ num, label }, i) => (
            <div key={label} style={{ padding: isMobile ? "12px 4px" : "14px 8px", textAlign: "center", borderRight: i < 4 ? "1.5px solid #E8E8E4" : "none" }}>
              <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 700, marginBottom: 2 }}>{num}</div>
              <div style={{ fontSize: isMobile ? 9 : 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* BIO */}
        {profile.bio && <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: "0 0 14px", maxWidth: 520 }}>{profile.bio}</p>}

        {/* SOCIAL LINKS */}
        {socialLinks.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {socialLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="social-chip"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", border: "1.5px solid #E8E8E4", borderRadius: 100, padding: "6px 13px", fontSize: 12, color: "#444", textDecoration: "none", fontWeight: 500 }}>
                {SOCIAL_ICONS[link.platform?.toLowerCase()] || SOCIAL_ICONS.website}
                {link.label || link.platform}
              </a>
            ))}
          </div>
        )}

        {/* RATINGS */}
        <div style={{ display: "flex", gap: 20, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>Host</span>
            <StarRating value={profile.host_rating || 0} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>Attendee</span>
            <StarRating value={profile.attendee_rating || 0} />
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", borderBottom: "1px solid #ECEAE6", marginBottom: 28 }}>
          {["posts", "garage", "about"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: "none", border: "none", padding: "11px 20px", fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, color: activeTab === tab ? "#1a1a1a" : "#aaa", borderBottom: activeTab === tab ? "2px solid #1a1a1a" : "2px solid transparent", cursor: "pointer", textTransform: "capitalize", marginBottom: -1, fontFamily: "inherit" }}>
              {tab === "posts" ? `Posts (${posts.length})` : tab === "garage" ? `Garage (${vehicles.length})` : "About"}
            </button>
          ))}
        </div>

        {/* ── POSTS TAB ── */}
        {activeTab === "posts" && (
          posts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 0", color: "#bbb", fontSize: 14 }}>
              {isOwner ? "Share your first photo." : "No posts yet."}
              {isOwner && <div style={{ marginTop: 14 }}><a href={`/u/${username}/edit`} style={{ background: "#1a1a1a", color: "white", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>Add Post</a></div>}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 6 }}>
              {posts.map((post, idx) => (
                <div key={post.id} className="post-thumb" onClick={() => setLightboxPost(post)}
                  style={{
                    aspectRatio: "1", background: "#E8E8E4", cursor: "pointer", position: "relative", overflow: "hidden",
                    borderRadius: idx === 0 ? 12 : 8,
                    gridColumn: idx === 0 && posts.length > 1 && !isMobile ? "span 2" : "span 1",
                    gridRow: idx === 0 && posts.length > 1 && !isMobile ? "span 2" : "span 1",
                  }}>
                  {post.media_type === "video"
                    ? <video src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    : <img src={post.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  }
                  {post.media_type === "video" && <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "white" }}>▶</div>}
                </div>
              ))}
            </div>
          )
        )}

        {/* ── GARAGE TAB ── */}
        {activeTab === "garage" && (
          vehicles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 0", color: "#bbb", fontSize: 14 }}>
              {isOwner ? "Add your first vehicle to start a mod list." : "No vehicles listed yet."}
              {isOwner && <div style={{ marginTop: 14 }}><a href={`/u/${username}/edit`} style={{ background: "#1a1a1a", color: "white", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>Add Vehicle</a></div>}
            </div>
          ) : (
            <>
              {/* Vehicle chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                {vehicles.map((v) => (
                  <button key={v.id} className="vehicle-chip" onClick={() => setSelectedVehicleId(v.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, border: `1.5px solid ${selectedVehicleId === v.id ? "#1a1a1a" : "#E8E8E4"}`, background: selectedVehicleId === v.id ? "#1a1a1a" : "white", color: selectedVehicleId === v.id ? "white" : "#555", borderRadius: 100, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                    {v.photo_url && <div style={{ width: 20, height: 20, borderRadius: "50%", background: `url(${v.photo_url}) center/cover`, flexShrink: 0 }} />}
                    {v.nickname || `${v.year || ""} ${v.make} ${v.model}`.trim()}
                    {v.is_primary && <span style={{ fontSize: 10, opacity: 0.55 }}>· primary</span>}
                  </button>
                ))}
              </div>

              {/* Vehicle card */}
              {selectedVehicle && (
                <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
                  {selectedVehicle.photo_url && (
                    <div style={{ height: 180, background: `url(${selectedVehicle.photo_url}) center/cover`, position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent 60%)" }} />
                    </div>
                  )}
                  <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 3 }}>
                        {selectedVehicle.nickname || `${selectedVehicle.year || ""} ${selectedVehicle.make} ${selectedVehicle.model}`.trim()}
                      </div>
                      <div style={{ fontSize: 13, color: "#888" }}>
                        {[selectedVehicle.year, selectedVehicle.make, selectedVehicle.model, selectedVehicle.trim].filter(Boolean).join(" ")}
                        {selectedVehicle.color && ` · ${selectedVehicle.color}`}
                      </div>
                    </div>
                    {selectedVehicle.is_primary && <span style={{ fontSize: 10, background: "#1a1a1a", color: "white", borderRadius: 100, padding: "3px 10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Primary</span>}
                  </div>
                </div>
              )}

              {/* Mod list */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Mod List ({displayMods.length})</div>
                {isOwner && <a href={`/u/${username}/edit`} style={{ fontSize: 12, color: "#888", textDecoration: "none" }}>+ Add mod</a>}
              </div>

              {Object.keys(modsByCategory).length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0", color: "#bbb", fontSize: 13 }}>No mods listed for this vehicle yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {Object.entries(modsByCategory).map(([cat, items]) => (
                    <div key={cat}>
                      <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700, marginBottom: 8 }}>{cat}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {items.map((mod) => (
                          <div key={mod.id} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: mod.brand ? 3 : 0 }}>{mod.mod_name}</div>
                              {mod.brand && <div style={{ fontSize: 12, color: "#888" }}>{mod.brand}</div>}
                              {mod.notes && <div style={{ fontSize: 12, color: "#aaa", marginTop: 3 }}>{mod.notes}</div>}
                            </div>
                            {mod.install_date && <div style={{ fontSize: 11, color: "#bbb", whiteSpace: "nowrap", flexShrink: 0 }}>{new Date(mod.install_date).toLocaleDateString(undefined, { year: "numeric", month: "short" })}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        )}

        {/* ── ABOUT TAB ── */}
        {activeTab === "about" && (
          <div style={{ maxWidth: 520 }}>
            {profile.bio && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>Bio</div>
                <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: 0 }}>{profile.bio}</p>
              </div>
            )}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 12 }}>Reputation</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Host Rating", rating: profile.host_rating, count: profile.meets_hosted_count, unit: "meets hosted" },
                  { label: "Attendee Rating", rating: profile.attendee_rating, count: profile.meets_attended_count, unit: "meets attended" },
                ].map(({ label, rating, count, unit }) => (
                  <div key={label} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
                    <StarRating value={rating || 0} />
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>{count || 0} {unit}</div>
                  </div>
                ))}
              </div>
            </div>
            {socialLinks.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 12 }}>Links</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {socialLinks.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "12px 16px", textDecoration: "none", color: "#1a1a1a", fontSize: 14, fontWeight: 500 }}>
                      {SOCIAL_ICONS[link.platform?.toLowerCase()] || SOCIAL_ICONS.website}
                      <span>{link.label || link.platform}</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{link.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LIGHTBOX */}
      {lightboxPost && (
        <div onClick={() => setLightboxPost(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, overflow: "hidden", maxWidth: 560, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {lightboxPost.media_type === "video"
              ? <video src={lightboxPost.media_url} controls style={{ width: "100%", maxHeight: 420, objectFit: "contain", background: "#000" }} />
              : <img src={lightboxPost.media_url} alt="" style={{ width: "100%", maxHeight: 480, objectFit: "contain", background: "#000" }} />
            }
            {lightboxPost.caption && <div style={{ padding: "14px 20px", fontSize: 14, color: "#444", lineHeight: 1.5 }}>{lightboxPost.caption}</div>}
            <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#bbb" }}>{new Date(lightboxPost.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
              <button onClick={() => setLightboxPost(null)} style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "#555", fontFamily: "inherit" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
