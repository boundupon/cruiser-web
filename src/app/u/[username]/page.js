"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const MOD_CATEGORIES = [
  "Engine / Performance",
  "Exhaust",
  "Suspension",
  "Wheels & Tires",
  "Exterior / Cosmetic",
  "Interior",
  "Audio",
  "Tune / ECU",
  "Wrap / Paint",
];

const SOCIAL_ICONS = {
  instagram: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  ),
  youtube: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
    </svg>
  ),
  tiktok: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
    </svg>
  ),
  facebook: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  ),
  website: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
};

function StarRating({ value }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width="13" height="13" viewBox="0 0 24 24"
          fill={s <= Math.round(value) ? "#f59e0b" : "none"}
          stroke="#f59e0b" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
      <span style={{ fontSize: 12, color: "#888", marginLeft: 4 }}>{Number(value).toFixed(1)}</span>
    </span>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const username = params?.username;

  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mods, setMods] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("mods");
  const [isMobile, setIsMobile] = useState(false);
  const [lightboxPost, setLightboxPost] = useState(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (!username) return;
    async function load() {
      setLoading(true);
      try {
        const [pRes, mRes, postRes] = await Promise.all([
          fetch(`${API_BASE}/profiles/${username}`),
          fetch(`${API_BASE}/profiles/${username}/mods`),
          fetch(`${API_BASE}/profiles/${username}/posts`),
        ]);
        if (pRes.status === 404) { setNotFound(true); return; }
        const [p, m, po] = await Promise.all([pRes.json(), mRes.json(), postRes.json()]);
        setProfile(p);
        setMods(Array.isArray(m) ? m : []);
        setPosts(Array.isArray(po) ? po : []);
      } catch (e) {
        console.error(e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username]);

  const isOwner = currentUser && profile && currentUser.id === profile.id;

  // Group mods by category
  const modsByCategory = MOD_CATEGORIES.reduce((acc, cat) => {
    const items = mods.filter((m) => m.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: "#bbb", fontSize: 15 }}>Loading profile...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Profile not found</div>
        <div style={{ color: "#888", fontSize: 14 }}>@{username} doesn't exist on Cruiser.</div>
        <a href="/" style={{ display: "inline-block", marginTop: 24, background: "#1a1a1a", color: "white", borderRadius: 8, padding: "10px 24px", fontSize: 14, textDecoration: "none", fontWeight: 500 }}>
          Back to home
        </a>
      </div>
    </div>
  );

  const socialLinks = Array.isArray(profile.social_links) ? profile.social_links : [];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", fontFamily: "'DM Sans', -apple-system, sans-serif", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </a>
          <div style={{ display: "flex", gap: 8 }}>
            {isOwner && (
              <a href={`/u/${username}/edit`}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}>
                Edit Profile
              </a>
            )}
            {!currentUser && (
              <a href="/" style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#555", textDecoration: "none" }}>
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>

      {/* BANNER */}
      <div style={{
        height: isMobile ? 160 : 240,
        background: profile.banner_image_url
          ? `url(${profile.banner_image_url}) center/cover no-repeat`
          : "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #444 100%)",
        position: "relative",
      }} />

      {/* PROFILE HEADER */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "0 16px" : "0 32px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: isMobile ? -44 : -56, marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width: isMobile ? 88 : 112,
            height: isMobile ? 88 : 112,
            borderRadius: "50%",
            border: "4px solid #FAFAF9",
            background: profile.profile_photo_url ? `url(${profile.profile_photo_url}) center/cover` : "#E8E8E4",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            fontSize: 36,
            color: "#aaa",
          }}>
            {!profile.profile_photo_url && "👤"}
          </div>
          {/* Edit button (mobile moves here) */}
          {isOwner && isMobile && (
            <a href={`/u/${username}/edit`}
              style={{ background: "#1a1a1a", color: "white", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, textDecoration: "none", marginTop: 48 }}>
              Edit Profile
            </a>
          )}
        </div>

        {/* Name + location + bio */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, margin: "0 0 4px" }}>
            {profile.display_name || `@${profile.username}`}
          </h1>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>@{profile.username}</div>
          {(profile.city || profile.state) && (
            <div style={{ fontSize: 14, color: "#666", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
              📍 {[profile.city, profile.state].filter(Boolean).join(", ")}
            </div>
          )}
          {profile.bio && (
            <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 16px", maxWidth: 520 }}>
              {profile.bio}
            </p>
          )}
        </div>

        {/* RATINGS & STATS */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Host Rating", value: <StarRating value={profile.host_rating || 0} />, sub: `${profile.meets_hosted_count || 0} meets hosted` },
            { label: "Attendee Rating", value: <StarRating value={profile.attendee_rating || 0} />, sub: `${profile.meets_attended_count || 0} meets attended` },
            { label: "Meets Hosted", value: <span style={{ fontSize: 22, fontWeight: 700 }}>{profile.meets_hosted_count || 0}</span>, sub: "total hosted" },
            { label: "Meets Attended", value: <span style={{ fontSize: 22, fontWeight: 700 }}>{profile.meets_attended_count || 0}</span>, sub: "total attended" },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
              <div style={{ marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: "#bbb" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* SOCIAL LINKS */}
        {socialLinks.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
            {socialLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "white", border: "1.5px solid #E8E8E4", borderRadius: 100, padding: "7px 14px", fontSize: 13, color: "#444", textDecoration: "none", fontWeight: 500 }}>
                {SOCIAL_ICONS[link.platform?.toLowerCase()] || SOCIAL_ICONS.website}
                {link.label || link.platform}
              </a>
            ))}
          </div>
        )}

        {/* TABS */}
        <div style={{ display: "flex", borderBottom: "1px solid #ECEAE6", marginBottom: 32, gap: 0 }}>
          {["mods", "posts"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                background: "none", border: "none", padding: "12px 20px",
                fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? "#1a1a1a" : "#aaa",
                borderBottom: activeTab === tab ? "2px solid #1a1a1a" : "2px solid transparent",
                cursor: "pointer", textTransform: "capitalize", marginBottom: -1,
              }}>
              {tab === "mods" ? `Mod List (${mods.length})` : `Posts (${posts.length})`}
            </button>
          ))}
        </div>

        {/* MOD LIST TAB */}
        {activeTab === "mods" && (
          <div style={{ marginBottom: 64 }}>
            {Object.keys(modsByCategory).length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#bbb", fontSize: 15 }}>
                {isOwner ? "Add your first mod to show off your build." : "No mods listed yet."}
                {isOwner && (
                  <div style={{ marginTop: 16 }}>
                    <a href={`/u/${username}/edit`}
                      style={{ background: "#1a1a1a", color: "white", borderRadius: 8, padding: "10px 22px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                      Add Mods
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {Object.entries(modsByCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>
                      {cat}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {items.map((mod) => (
                        <div key={mod.id} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: mod.brand || mod.notes ? 4 : 0 }}>
                              {mod.mod_name}
                            </div>
                            {mod.brand && <div style={{ fontSize: 13, color: "#888" }}>{mod.brand}</div>}
                            {mod.notes && <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>{mod.notes}</div>}
                          </div>
                          {mod.install_date && (
                            <div style={{ fontSize: 12, color: "#bbb", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {new Date(mod.install_date).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* POSTS GRID TAB */}
        {activeTab === "posts" && (
          <div style={{ marginBottom: 64 }}>
            {posts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#bbb", fontSize: 15 }}>
                {isOwner ? "Share your first photo or reel." : "No posts yet."}
                {isOwner && (
                  <div style={{ marginTop: 16 }}>
                    <a href={`/u/${username}/edit`}
                      style={{ background: "#1a1a1a", color: "white", borderRadius: 8, padding: "10px 22px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
                      Add Post
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 10 }}>
                {posts.map((post) => (
                  <div key={post.id} onClick={() => setLightboxPost(post)}
                    style={{ aspectRatio: "1", background: "#E8E8E4", borderRadius: 10, overflow: "hidden", cursor: "pointer", position: "relative" }}>
                    {post.media_type === "video" ? (
                      <video src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    ) : (
                      <img src={post.media_url} alt={post.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    {post.media_type === "video" && (
                      <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 6px", fontSize: 10, color: "white" }}>▶</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* LIGHTBOX */}
      {lightboxPost && (
        <div onClick={() => setLightboxPost(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 16, overflow: "hidden", maxWidth: 560, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {lightboxPost.media_type === "video" ? (
              <video src={lightboxPost.media_url} controls style={{ width: "100%", maxHeight: 400, objectFit: "contain", background: "#000" }} />
            ) : (
              <img src={lightboxPost.media_url} alt="" style={{ width: "100%", maxHeight: 480, objectFit: "contain", background: "#000" }} />
            )}
            {lightboxPost.caption && (
              <div style={{ padding: "16px 20px", fontSize: 14, color: "#444", lineHeight: 1.5 }}>{lightboxPost.caption}</div>
            )}
            <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#bbb" }}>
                {new Date(lightboxPost.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </span>
              <button onClick={() => setLightboxPost(null)}
                style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
