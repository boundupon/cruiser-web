"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const SOCIAL_PLATFORMS = ["Instagram", "YouTube", "TikTok", "Facebook", "Website"];

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [usernameStatus, setUsernameStatus] = useState(null);
  const debouncedUsername = useDebounce(username, 500);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push("/"); return; }
      setAuthLoading(false);
      const suggestion = session.user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "";
      setUsername(suggestion);
      setDisplayName(suggestion);
      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const p = await res.json();
        if (p?.username) router.push(`/u/${p.username}/edit`);
      }
    });
  }, []);

  // Real-time username check
  useEffect(() => {
    if (!debouncedUsername) { setUsernameStatus(null); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(debouncedUsername)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    fetch(`${API_BASE}/profiles/${debouncedUsername}`)
      .then((res) => {
        if (res.status === 404) setUsernameStatus("available");
        else if (res.ok) setUsernameStatus("taken");
        else setUsernameStatus("available");
      })
      .catch(() => setUsernameStatus("available"));
  }, [debouncedUsername]);

  async function uploadFile(file, bucket) {
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
    if (file.size > 5 * 1024 * 1024) { setError("Avatar must be under 5MB."); return; }
    setAvatarUploading(true);
    try { setProfilePhotoUrl(await uploadFile(file, "profile-photos")); }
    catch (err) { setError("Upload failed: " + err.message); }
    finally { setAvatarUploading(false); }
  }

  async function handleBannerUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError("Banner must be under 8MB."); return; }
    setBannerUploading(true);
    try { setBannerUrl(await uploadFile(file, "profile-banners")); }
    catch (err) { setError("Upload failed: " + err.message); }
    finally { setBannerUploading(false); }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!username.trim()) { setError("Username is required."); return; }
    if (usernameStatus === "taken") { setError("That username is already taken. Please choose another."); return; }
    if (usernameStatus === "invalid") { setError("Username must be 3–30 lowercase letters, numbers, or underscores."); return; }
    if (usernameStatus === "checking") { setError("Still checking availability — try again in a moment."); return; }
    setSaving(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          username,
          city, state, bio, social_links: socialLinks,
          profile_photo_url: profilePhotoUrl,
          banner_image_url: bannerUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.push(`/u/${username}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function addSocialLink() { setSocialLinks([...socialLinks, { platform: "Instagram", label: "", url: "" }]); }
  function updateSocialLink(i, field, val) {
    const u = [...socialLinks]; u[i] = { ...u[i], [field]: val }; setSocialLinks(u);
  }
  function removeSocialLink(i) { setSocialLinks(socialLinks.filter((_, idx) => idx !== i)); }

  const usernameHint = {
    null: null,
    checking: { color: "#888", text: "Checking availability..." },
    available: { color: "#16a34a", text: "✓ Available" },
    taken: { color: "#dc2626", text: "✕ Already taken — try another" },
    invalid: { color: "#dc2626", text: "3–30 characters: letters, numbers, underscores only" },
  }[usernameStatus];

  const usernameBorder = { available: "#16a34a", taken: "#dc2626", invalid: "#dc2626" }[usernameStatus] || "#E8E8E4";
  const canSubmit = !saving && usernameStatus !== "taken" && usernameStatus !== "checking" && usernameStatus !== "invalid";

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
        * { box-sizing: border-box; } body { margin: 0; }
        input, select, textarea, button { font-family: inherit; }
        ::placeholder { color: #bbb; }
      `}</style>

      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", height: 60 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </a>
        </div>
      </header>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: isMobile ? "32px 16px 64px" : "48px 32px 64px" }}>

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
          <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, margin: "0 0 10px" }}>Choose your username</h1>
          <p style={{ fontSize: 15, color: "#888", margin: 0, lineHeight: 1.6 }}>
            This is your unique identity on Cruiser.<br />You can fill in the rest of your profile later.
          </p>
        </div>

        <form onSubmit={handleSave}>

          {/* USERNAME */}
          <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 16, padding: 24, marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 10 }}>Username *</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#bbb", pointerEvents: "none" }}>@</span>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="yourname"
                maxLength={30}
                style={{ ...inp, paddingLeft: 30, fontSize: 18, fontWeight: 500, border: `1.5px solid ${usernameBorder}` }}
              />
            </div>
            <div style={{ fontSize: 12, marginTop: 8, color: usernameHint?.color || "#bbb" }}>
              {usernameHint ? usernameHint.text : username ? `cruiser-web.vercel.app/u/${username}` : "Letters, numbers, and underscores only"}
            </div>
          </div>

          {/* OPTIONAL INFO */}
          <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 16, padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 16 }}>
              Profile Info <span style={{ color: "#bbb", fontWeight: 400 }}>(optional)</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Banner Image</label>
              <label style={{
                display: "block", height: 90, borderRadius: 10, overflow: "hidden",
                background: bannerUrl ? `url(${bannerUrl}) center/cover` : "#F0EFEB",
                cursor: "pointer", position: "relative", border: "1.5px solid #E8E8E4",
              }}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerUpload} disabled={bannerUploading} />
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: bannerUrl ? "rgba(0,0,0,0.3)" : "transparent" }}>
                  <span style={{ fontSize: 12, color: bannerUrl ? "white" : "#aaa" }}>
                    {bannerUploading ? "Uploading..." : bannerUrl ? "Click to change" : "📷 Upload banner"}
                  </span>
                </div>
              </label>
            </div>

            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
              <label style={{ cursor: "pointer", flexShrink: 0 }}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} disabled={avatarUploading} />
                <div style={{
                  width: 60, height: 60, borderRadius: "50%", border: "2px dashed #E8E8E4",
                  background: profilePhotoUrl ? `url(${profilePhotoUrl}) center/cover` : "#F0EFEB",
                  display: "grid", placeItems: "center", fontSize: 20, color: "#bbb",
                }}>
                  {!profilePhotoUrl && (avatarUploading ? "…" : "👤")}
                </div>
              </label>
              <div style={{ fontSize: 13, color: "#aaa" }}>{avatarUploading ? "Uploading..." : "Click to upload profile photo"}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Norfolk" style={inp} />
              </div>
              <div>
                <label style={lbl}>State</label>
                <input value={state} onChange={(e) => setState(e.target.value)} placeholder="VA" maxLength={30} style={inp} />
              </div>
            </div>

            <div>
              <label style={lbl}>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community about yourself and your build..." rows={2}
                style={{ ...inp, resize: "vertical" }} maxLength={300} />
            </div>
          </div>

          {/* SOCIAL LINKS */}
          <div style={{ marginBottom: 20 }}>
            {socialLinks.map((link, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                <select value={link.platform} onChange={(e) => updateSocialLink(i, "platform", e.target.value)} style={{ ...inp, padding: "11px 8px" }}>
                  {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
                <input value={link.url} onChange={(e) => updateSocialLink(i, "url", e.target.value)} placeholder="https://..." style={inp} type="url" />
                <button type="button" onClick={() => removeSocialLink(i)}
                  style={{ background: "none", border: "1.5px solid #FECACA", borderRadius: 8, padding: "10px 12px", fontSize: 13, cursor: "pointer", color: "#DC2626" }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={addSocialLink}
              style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "#555" }}>
              + Add social link
            </button>
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={!canSubmit}
            style={{
              background: "#1a1a1a", color: "white", border: "none", borderRadius: 8,
              padding: "14px", fontSize: 15, fontWeight: 500, width: "100%",
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.5,
            }}>
            {saving ? "Creating profile..." : "Claim my username →"}
          </button>

          <p style={{ fontSize: 12, color: "#bbb", textAlign: "center", marginTop: 14, marginBottom: 0 }}>
            You can update your photo and bio at any time.
          </p>
        </form>
      </div>
    </div>
  );
}
