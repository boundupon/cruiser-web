"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const GROUP_TYPES = [
  { value: "car_club",        label: "Car Club",          desc: "A local club or crew" },
  { value: "brand_model",     label: "Brand / Model",     desc: "Mustang, BMW, Subaru owners, etc." },
  { value: "regional_crew",   label: "Regional Crew",     desc: "Hampton Roads, NoVA, Texas, etc." },
  { value: "event_organizer", label: "Event Organizer",   desc: "Texas 2K, Cars & Coffee, Sumospeed, etc." },
];

export default function CreateGroupPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [location, setLocation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (!u) router.push("/");
    });
  }, []);

  async function handleUpload(file, bucket, setUrl, setUploading) {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `group-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  async function handleSubmit() {
    if (!name.trim()) { setError("Group name is required."); return; }
    if (!type) { setError("Please select a group type."); return; }
    setSaving(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: name.trim(), description, type, privacy, location, avatar_url: avatarUrl, banner_url: bannerUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      router.push(`/groups/${data.slug}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inp = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "white", fontFamily: "inherit" };
  const lbl = { fontSize: 12, color: "#888", display: "block", marginBottom: 6, fontWeight: 500 };

  // Live slug preview
  const slugPreview = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "your-group-name";

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Cruiser</span>
          </button>
          <button onClick={() => router.push("/groups")} style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#555", cursor: "pointer" }}>
            ← All Groups
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 620, margin: "0 auto", padding: isMobile ? "24px 16px 80px" : "48px 20px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 26 : 32, fontWeight: 800, margin: "0 0 8px" }}>Create a Group</h1>
          <p style={{ fontSize: 14, color: "#888", margin: 0 }}>Build your community on Cruiser.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Banner */}
          <div>
            <label style={lbl}>Banner Image <span style={{ color: "#ccc", fontWeight: 400 }}>(optional)</span></label>
            <div style={{
              height: 110, borderRadius: 10, border: "1.5px dashed #E8E8E4",
              background: bannerUrl ? `url(${bannerUrl}) center/cover` : "#F5F5F3",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              overflow: "hidden", position: "relative",
            }} onClick={() => document.getElementById("create-banner").click()}>
              {!bannerUrl && <span style={{ fontSize: 13, color: "#bbb" }}>📷 Upload banner</span>}
              {bannerUrl && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "white", fontSize: 13 }}>{bannerUploading ? "Uploading..." : "Click to change"}</span>
              </div>}
            </div>
            <input id="create-banner" type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleUpload(e.target.files[0], "profile-banners", setBannerUrl, setBannerUploading)} />
          </div>

          {/* Avatar */}
          <div>
            <label style={lbl}>Group Avatar <span style={{ color: "#ccc", fontWeight: 400 }}>(optional)</span></label>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 12, border: "1.5px dashed #E8E8E4",
                background: avatarUrl ? `url(${avatarUrl}) center/cover` : "#F5F5F3",
                display: "grid", placeItems: "center", cursor: "pointer", fontSize: 24,
              }} onClick={() => document.getElementById("create-avatar").click()}>
                {!avatarUrl && "🏁"}
              </div>
              <div style={{ fontSize: 13, color: "#aaa" }}>{avatarUploading ? "Uploading..." : "Click to upload"}</div>
            </div>
            <input id="create-avatar" type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleUpload(e.target.files[0], "profile-photos", setAvatarUrl, setAvatarUploading)} />
          </div>

          {/* Name */}
          <div>
            <label style={lbl}>Group Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hampton Roads Car Club" style={inp} maxLength={60} />
            <div style={{ fontSize: 12, color: "#bbb", marginTop: 5 }}>cruiser.app/groups/{slugPreview}</div>
          </div>

          {/* Type */}
          <div>
            <label style={lbl}>Group Type *</label>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr", gap: 10 }}>
              {GROUP_TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  style={{
                    background: type === t.value ? "#1a1a1a" : "white",
                    color: type === t.value ? "white" : "#1a1a1a",
                    border: `1.5px solid ${type === t.value ? "#1a1a1a" : "#E8E8E4"}`,
                    borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left",
                    transition: "all 0.1s",
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontSize: 11, opacity: type === t.value ? 0.7 : 0.5, lineHeight: 1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div>
            <label style={lbl}>Privacy</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { value: "public", label: "🌐 Public", desc: "Anyone can join instantly" },
                { value: "private", label: "🔒 Private", desc: "You approve each member" },
              ].map(p => (
                <button key={p.value} onClick={() => setPrivacy(p.value)}
                  style={{
                    background: privacy === p.value ? "#1a1a1a" : "white",
                    color: privacy === p.value ? "white" : "#1a1a1a",
                    border: `1.5px solid ${privacy === p.value ? "#1a1a1a" : "#E8E8E4"}`,
                    borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left",
                    transition: "all 0.1s",
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{p.label}</div>
                  <div style={{ fontSize: 11, opacity: privacy === p.value ? 0.7 : 0.5 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={lbl}>Location <span style={{ color: "#ccc", fontWeight: 400 }}>(optional)</span></label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Hampton Roads, VA" style={inp} maxLength={80} />
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>Description <span style={{ color: "#ccc", fontWeight: 400 }}>(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Tell people what your group is about..."
              style={{ ...inp, height: 100, resize: "vertical" }} maxLength={500} />
            <div style={{ fontSize: 11, color: "#ccc", marginTop: 4, textAlign: "right" }}>{description.length}/500</div>
          </div>

          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626" }}>{error}</div>}

          <button onClick={handleSubmit} disabled={saving || !name.trim() || !type}
            style={{
              background: saving || !name.trim() || !type ? "#ccc" : "#1a1a1a",
              color: "white", border: "none", borderRadius: 10, padding: "14px",
              fontSize: 15, fontWeight: 700, cursor: saving || !name.trim() || !type ? "not-allowed" : "pointer",
              transition: "background 0.1s",
            }}>
            {saving ? "Creating..." : "Create Group →"}
          </button>
        </div>
      </main>
    </div>
  );
}
