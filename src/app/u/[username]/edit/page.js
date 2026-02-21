"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../supabaseClient";

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

const SOCIAL_PLATFORMS = ["Instagram", "YouTube", "TikTok", "Facebook", "Website"];

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username;

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [usernameField, setUsernameField] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  // Upload states
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Mods
  const [mods, setMods] = useState([]);
  const [modsLoading, setModsLoading] = useState(false);
  const [newMod, setNewMod] = useState({ category: MOD_CATEGORIES[0], mod_name: "", brand: "", install_date: "", notes: "" });
  const [modAdding, setModAdding] = useState(false);
  const [modError, setModError] = useState("");

  // Posts
  const [posts, setPosts] = useState([]);
  const [postUploading, setPostUploading] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [postPreview, setPostPreview] = useState("");
  const [postError, setPostError] = useState("");
  const [postSuccess, setPostSuccess] = useState(false);
  const postInputRef = useRef();

  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push("/"); return; }
      setUser(session.user);
      setAuthLoading(false);
      // Load existing profile
      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const p = await res.json();
        if (p) {
          setDisplayName(p.display_name || "");
          setUsernameField(p.username || "");
          setCity(p.city || "");
          setState(p.state || "");
          setBio(p.bio || "");
          setSocialLinks(Array.isArray(p.social_links) ? p.social_links : []);
          setProfilePhotoUrl(p.profile_photo_url || "");
          setBannerUrl(p.banner_image_url || "");
        }
      }
      // Load mods and posts
      if (username) {
        loadMods(session.access_token);
        loadPosts(username);
      }
    });
  }, [username]);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async function loadMods(token) {
    setModsLoading(true);
    const t = token || await getToken();
    const res = await fetch(`${API_BASE}/profiles/${username}/mods`);
    if (res.ok) setMods(await res.json());
    setModsLoading(false);
  }

  async function loadPosts(u) {
    const res = await fetch(`${API_BASE}/profiles/${u}/posts`);
    if (res.ok) setPosts(await res.json());
  }

  // Upload helper
  async function uploadFile(file, bucket, folder) {
    const { data: { session } } = await supabase.auth.getSession();
    const ext = file.name.split(".").pop();
    const fileName = `${session.user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicUrl;
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setProfileError("Avatar must be under 5MB."); return; }
    setAvatarUploading(true);
    setProfileError("");
    try {
      const url = await uploadFile(file, "profile-photos", "");
      setProfilePhotoUrl(url);
    } catch (err) {
      setProfileError("Upload failed: " + err.message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleBannerUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setProfileError("Banner must be under 8MB."); return; }
    setBannerUploading(true);
    setProfileError("");
    try {
      const url = await uploadFile(file, "profile-banners", "");
      setBannerUrl(url);
    } catch (err) {
      setProfileError("Upload failed: " + err.message);
    } finally {
      setBannerUploading(false);
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: usernameField,
          display_name: displayName,
          city, state, bio,
          social_links: socialLinks,
          profile_photo_url: profilePhotoUrl,
          banner_image_url: bannerUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
      // Redirect if username changed
      if (usernameField && usernameField !== username) {
        router.push(`/u/${usernameField}/edit`);
      }
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  // Social links helpers
  function addSocialLink() {
    setSocialLinks([...socialLinks, { platform: "Instagram", label: "", url: "" }]);
  }
  function updateSocialLink(i, field, val) {
    const updated = [...socialLinks];
    updated[i] = { ...updated[i], [field]: val };
    setSocialLinks(updated);
  }
  function removeSocialLink(i) {
    setSocialLinks(socialLinks.filter((_, idx) => idx !== i));
  }

  // Mod handlers
  async function handleAddMod(e) {
    e.preventDefault();
    if (!newMod.mod_name.trim()) { setModError("Mod name is required."); return; }
    setModAdding(true);
    setModError("");
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/mods`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newMod),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add mod");
      setMods((prev) => [...prev, data]);
      setNewMod({ category: MOD_CATEGORIES[0], mod_name: "", brand: "", install_date: "", notes: "" });
    } catch (err) {
      setModError(err.message);
    } finally {
      setModAdding(false);
    }
  }

  async function handleDeleteMod(id) {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/mods/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setMods((prev) => prev.filter((m) => m.id !== id));
  }

  // Post handlers
  async function handlePostUpload(e) {
    e.preventDefault();
    if (!postFile) { setPostError("Please select a photo or video."); return; }
    setPostUploading(true);
    setPostError("");
    setPostSuccess(false);
    try {
      const token = await getToken();
      const isVideo = postFile.type.startsWith("video/");
      const url = await uploadFile(postFile, "post-media", "");
      const res = await fetch(`${API_BASE}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ media_url: url, media_type: isVideo ? "video" : "photo", caption: postCaption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Post failed");
      setPosts((prev) => [data, ...prev]);
      setPostFile(null);
      setPostPreview("");
      setPostCaption("");
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPostUploading(false);
    }
  }

  async function handleDeletePost(id) {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/posts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  const inp = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9", fontFamily: "inherit" };
  const lbl = { fontSize: 12, color: "#999", display: "block", marginBottom: 6 };

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: "#bbb" }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", fontFamily: "'DM Sans', -apple-system, sans-serif", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, select, textarea, button { font-family: inherit; }
        ::placeholder { color: #bbb; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </a>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href={`/u/${username}`}
              style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#555", textDecoration: "none" }}>
              View Profile
            </a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "24px 16px 64px" : "32px 32px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px" }}>Edit Profile</h1>

        {/* TABS */}
        <div style={{ display: "flex", borderBottom: "1px solid #ECEAE6", marginBottom: 32, gap: 0 }}>
          {[
            { key: "profile", label: "Profile & Info" },
            { key: "mods", label: `Mod List (${mods.length})` },
            { key: "posts", label: `Posts (${posts.length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{
                background: "none", border: "none", padding: "12px 20px",
                fontSize: 14, fontWeight: activeTab === key ? 600 : 400,
                color: activeTab === key ? "#1a1a1a" : "#aaa",
                borderBottom: activeTab === key ? "2px solid #1a1a1a" : "2px solid transparent",
                cursor: "pointer", marginBottom: -1,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <form onSubmit={handleProfileSave}>
            {/* Banner upload */}
            <div style={{ marginBottom: 24 }}>
              <label style={lbl}>Banner Image</label>
              <label style={{
                display: "block", height: 140, borderRadius: 12, overflow: "hidden",
                background: bannerUrl ? `url(${bannerUrl}) center/cover` : "#E8E8E4",
                cursor: "pointer", position: "relative", border: "1.5px solid #E8E8E4",
              }}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerUpload} disabled={bannerUploading} />
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: bannerUrl ? "rgba(0,0,0,0.35)" : "transparent" }}>
                  <div style={{ color: bannerUrl ? "white" : "#aaa", fontSize: 13, textAlign: "center" }}>
                    {bannerUploading ? "Uploading..." : bannerUrl ? "Click to change banner" : "📷 Upload banner image"}
                  </div>
                </div>
              </label>
            </div>

            {/* Avatar upload */}
            <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
              <label style={{ cursor: "pointer", flexShrink: 0 }}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} disabled={avatarUploading} />
                <div style={{
                  width: 80, height: 80, borderRadius: "50%", border: "2px dashed #E8E8E4",
                  background: profilePhotoUrl ? `url(${profilePhotoUrl}) center/cover` : "#F0EFEB",
                  display: "grid", placeItems: "center", fontSize: 24, color: "#bbb",
                }}>
                  {!profilePhotoUrl && (avatarUploading ? "…" : "👤")}
                </div>
              </label>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Profile Photo</div>
                <div style={{ fontSize: 12, color: "#aaa" }}>{avatarUploading ? "Uploading..." : "Click avatar to upload"}</div>
              </div>
            </div>

            {/* Core fields */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Display Name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" style={inp} />
              </div>
              <div>
                <label style={lbl}>Username *</label>
                <input required value={usernameField} onChange={(e) => setUsernameField(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="e.g. shadowhollow" style={inp} maxLength={30} />
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>Letters, numbers, underscores only</div>
              </div>
              <div>
                <label style={lbl}>City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Norfolk" style={inp} />
              </div>
              <div>
                <label style={lbl}>State</label>
                <input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. VA" maxLength={30} style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={lbl}>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community about yourself and your build..." rows={3}
                style={{ ...inp, resize: "vertical" }} maxLength={300} />
              <div style={{ fontSize: 11, color: "#bbb", marginTop: 4, textAlign: "right" }}>{bio.length}/300</div>
            </div>

            {/* Social Links */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <label style={{ ...lbl, margin: 0 }}>Social Links</label>
                <button type="button" onClick={addSocialLink}
                  style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", color: "#555" }}>
                  + Add Link
                </button>
              </div>
              {socialLinks.map((link, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "140px 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                  <select value={link.platform} onChange={(e) => updateSocialLink(i, "platform", e.target.value)}
                    style={{ ...inp, padding: "11px 10px" }}>
                    {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <input value={link.label} onChange={(e) => updateSocialLink(i, "label", e.target.value)}
                    placeholder="Label (optional)" style={inp} />
                  <input value={link.url} onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                    placeholder="https://..." style={inp} type="url" />
                  <button type="button" onClick={() => removeSocialLink(i)}
                    style={{ background: "none", border: "1.5px solid #FECACA", borderRadius: 8, padding: "10px 12px", fontSize: 13, cursor: "pointer", color: "#DC2626", whiteSpace: "nowrap" }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {profileError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
                {profileError}
              </div>
            )}
            {profileSaved && (
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 16 }}>
                ✓ Profile saved!
              </div>
            )}

            <button type="submit" disabled={profileSaving}
              style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 14, fontWeight: 500, cursor: profileSaving ? "not-allowed" : "pointer", opacity: profileSaving ? 0.7 : 1 }}>
              {profileSaving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        )}

        {/* ── MODS TAB ── */}
        {activeTab === "mods" && (
          <div>
            {/* Add mod form */}
            <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 16, padding: 24, marginBottom: 32 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px" }}>Add a Mod</h3>
              <form onSubmit={handleAddMod}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={lbl}>Category *</label>
                    <select value={newMod.category} onChange={(e) => setNewMod({ ...newMod, category: e.target.value })} style={{ ...inp, padding: "11px 10px" }}>
                      {MOD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Mod Name *</label>
                    <input value={newMod.mod_name} onChange={(e) => setNewMod({ ...newMod, mod_name: e.target.value })}
                      placeholder="e.g. Cold Air Intake" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Brand</label>
                    <input value={newMod.brand} onChange={(e) => setNewMod({ ...newMod, brand: e.target.value })}
                      placeholder="e.g. K&N" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Install Date</label>
                    <input type="date" value={newMod.install_date} onChange={(e) => setNewMod({ ...newMod, install_date: e.target.value })} style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Notes</label>
                  <input value={newMod.notes} onChange={(e) => setNewMod({ ...newMod, notes: e.target.value })}
                    placeholder="Any details, part numbers, etc." style={inp} />
                </div>
                {modError && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 12 }}>
                    {modError}
                  </div>
                )}
                <button type="submit" disabled={modAdding}
                  style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 14, fontWeight: 500, cursor: modAdding ? "not-allowed" : "pointer", opacity: modAdding ? 0.7 : 1 }}>
                  {modAdding ? "Adding..." : "Add Mod"}
                </button>
              </form>
            </div>

            {/* Existing mods */}
            {modsLoading ? (
              <div style={{ color: "#bbb", fontSize: 14 }}>Loading mods...</div>
            ) : mods.length === 0 ? (
              <div style={{ textAlign: "center", color: "#bbb", padding: "32px 0", fontSize: 14 }}>No mods yet — add your first one above.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {mods.map((mod) => (
                  <div key={mod.id} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{mod.category}</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{mod.mod_name}</div>
                      {mod.brand && <div style={{ fontSize: 13, color: "#888" }}>{mod.brand}</div>}
                      {mod.notes && <div style={{ fontSize: 13, color: "#aaa" }}>{mod.notes}</div>}
                    </div>
                    <button onClick={() => handleDeleteMod(mod.id)}
                      style={{ background: "none", border: "1.5px solid #FECACA", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#DC2626", flexShrink: 0 }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── POSTS TAB ── */}
        {activeTab === "posts" && (
          <div>
            {/* Upload form */}
            <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 16, padding: 24, marginBottom: 32 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px" }}>Add a Post</h3>
              <form onSubmit={handlePostUpload}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    border: `2px dashed ${postPreview ? "#1a1a1a" : "#E8E8E4"}`, borderRadius: 10,
                    padding: postPreview ? 0 : "28px 16px", cursor: "pointer",
                    background: "#FAFAF9", overflow: "hidden", minHeight: postPreview ? 180 : "auto", position: "relative",
                  }}>
                    <input ref={postInputRef} type="file" accept="image/*,video/*" style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setPostFile(file);
                        setPostPreview(URL.createObjectURL(file));
                      }} />
                    {postPreview ? (
                      <>
                        {postFile?.type.startsWith("video/") ? (
                          <video src={postPreview} style={{ width: "100%", maxHeight: 240, objectFit: "contain", background: "#000" }} muted />
                        ) : (
                          <img src={postPreview} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover" }} />
                        )}
                        <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.55)", color: "white", fontSize: 11, padding: "4px 10px", borderRadius: 6 }}>
                          Click to change
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
                        <div style={{ fontSize: 13, color: "#888" }}>Click to upload photo or video</div>
                        <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>JPG, PNG, MP4, MOV — up to 50MB</div>
                      </>
                    )}
                  </label>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Caption</label>
                  <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value)}
                    placeholder="What's the story?" rows={2}
                    style={{ ...inp, resize: "vertical" }} maxLength={500} />
                </div>
                {postError && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 12 }}>
                    {postError}
                  </div>
                )}
                {postSuccess && (
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 12 }}>
                    ✓ Post added!
                  </div>
                )}
                <button type="submit" disabled={postUploading}
                  style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 14, fontWeight: 500, cursor: postUploading ? "not-allowed" : "pointer", opacity: postUploading ? 0.7 : 1 }}>
                  {postUploading ? "Uploading..." : "Post"}
                </button>
              </form>
            </div>

            {/* Existing posts grid */}
            {posts.length === 0 ? (
              <div style={{ textAlign: "center", color: "#bbb", padding: "32px 0", fontSize: 14 }}>No posts yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 10 }}>
                {posts.map((post) => (
                  <div key={post.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "#E8E8E4" }}>
                    {post.media_type === "video" ? (
                      <video src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    ) : (
                      <img src={post.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <button onClick={() => handleDeletePost(post.id)}
                      style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "white", cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
