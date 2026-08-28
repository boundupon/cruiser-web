"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function GroupManagePage() {
  const router = useRouter();
  const { slug } = useParams();

  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [membership, setMembership] = useState(null);
  const [activeTab, setActiveTab] = useState("members");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Meets linking
  const [linkedMeets, setLinkedMeets] = useState([]);
  const [meetSearch, setMeetSearch] = useState("");
  const [allMeets, setAllMeets] = useState([]);
  const [linkingId, setLinkingId] = useState(null);

  // Edit form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      if (!u) router.push('/groups');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
      if (!s?.user) router.push('/groups');
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!slug || !user) return;
    async function load() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session.access_token}` };

        const [gRes, mRes, pRes, memRes, meetsRes] = await Promise.all([
          fetch(`${API_BASE}/groups/${slug}`),
          fetch(`${API_BASE}/groups/${slug}/membership`, { headers }),
          fetch(`${API_BASE}/groups/${slug}/requests`, { headers }),
          fetch(`${API_BASE}/groups/${slug}/members`),
          fetch(`${API_BASE}/groups/${slug}/meets`),
        ]);

        const g = await gRes.json();
        const mem = await memRes.json();
        const m = await mRes.json();
        const linked = await meetsRes.json();

        setGroup(g);
        setMembership(m);
        setMembers(Array.isArray(mem) ? mem : []);
        setLinkedMeets(Array.isArray(linked) ? linked : []);

        // Populate edit form
        setName(g.name || "");
        setDescription(g.description || "");
        setLocation(g.location || "");
        setPrivacy(g.privacy || "public");
        setAvatarUrl(g.avatar_url || "");
        setBannerUrl(g.banner_url || "");

        // Only load requests if mod/owner
        if (pRes.ok) {
          const p = await pRes.json();
          setPending(Array.isArray(p) ? p : []);
        }

        // Redirect if not mod/owner
        if (!m || !["owner", "moderator"].includes(m.role)) {
          router.push(`/groups/${slug}`);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [slug, user]);

  async function handleRequest(userId, action) {
    setActionLoading(userId + action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${API_BASE}/groups/${slug}/requests/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action }),
      });
      setPending(prev => prev.filter(p => p.user_id !== userId));
      if (action === "approve") {
        const mRes = await fetch(`${API_BASE}/groups/${slug}/members`);
        const mData = await mRes.json();
        setMembers(Array.isArray(mData) ? mData : []);
        setGroup(prev => ({ ...prev, member_count: prev.member_count + 1 }));
      }
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  }

  async function handleRoleChange(userId, newRole) {
    setActionLoading(userId + "role");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${API_BASE}/groups/${slug}/members/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ role: newRole }),
      });
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  }

  async function handleRemoveMember(userId) {
    if (!confirm("Remove this member from the group?")) return;
    setActionLoading(userId + "remove");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${API_BASE}/groups/${slug}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      setGroup(prev => ({ ...prev, member_count: Math.max(0, prev.member_count - 1) }));
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  }

  useEffect(() => {
    if (activeTab !== "meets" || allMeets.length > 0) return;
    fetch(`${API_BASE}/meets`).then(res => res.json()).then(data => setAllMeets(Array.isArray(data) ? data : [])).catch(() => {});
  }, [activeTab]);

  async function handleLinkMeet(meetId) {
    setLinkingId(meetId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/groups/${slug}/meets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ meet_id: meetId }),
      });
      if (!res.ok) throw new Error("Failed");
      const meet = allMeets.find(m => m.id === meetId);
      if (meet) setLinkedMeets(prev => [meet, ...prev]);
      setMeetSearch("");
    } catch (e) { console.error(e); }
    finally { setLinkingId(null); }
  }

  async function handleUnlinkMeet(meetId) {
    setLinkingId(meetId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${API_BASE}/groups/${slug}/meets/${meetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setLinkedMeets(prev => prev.filter(m => m.id !== meetId));
    } catch (e) { console.error(e); }
    finally { setLinkingId(null); }
  }

  async function handleUpload(file, bucket, setUrl, setUploading) {
    if (!file) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const ext = file.name.split(".").pop();
      const path = `${userId}/group-${slug}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/groups/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name, description, location, privacy, avatar_url: avatarUrl, banner_url: bannerUrl }),
      });
      if (res.ok) {
        const updated = await res.json();
        setGroup(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDeleteGroup() {
    if (!confirm(`Delete "${group?.name}"? This cannot be undone.`)) return;
    if (!confirm("Are you absolutely sure? All members and data will be lost.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${API_BASE}/groups/${slug}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    router.push("/groups");
  }

  const inp = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "white", fontFamily: "inherit" };
  const lbl = { fontSize: 12, color: "#888", display: "block", marginBottom: 6, fontWeight: 500 };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: "#aaa" }}>Loading...</div>
    </div>
  );

  const isOwner = membership?.role === "owner";
  const tabs = [
    { id: "members", label: `Members (${members.length})` },
    { id: "requests", label: `Requests${pending.length > 0 ? ` (${pending.length})` : ""}` },
    { id: "meets", label: `Meets (${linkedMeets.length})` },
    { id: "settings", label: "Settings" },
  ];

  const linkedIds = new Set(linkedMeets.map(m => m.id));
  const meetResults = meetSearch.trim()
    ? allMeets.filter(m => !linkedIds.has(m.id) && (m.title || "").toLowerCase().includes(meetSearch.trim().toLowerCase()))
    : [];

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
          <button onClick={() => router.push(`/groups/${slug}`)} style={{ background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#555", cursor: "pointer" }}>
            ← View Group
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "24px 16px 60px" : "40px 20px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>Manage Group</h1>
          <div style={{ fontSize: 14, color: "#888" }}>{group?.name}</div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #ECEAE6", marginBottom: 28, display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                background: "none", border: "none", padding: "10px 16px", fontSize: 14,
                fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? "#1a1a1a" : "#aaa", cursor: "pointer",
                borderBottom: `2px solid ${activeTab === t.id ? "#1a1a1a" : "transparent"}`,
                marginBottom: -1, position: "relative",
              }}>
              {t.label}
              {t.id === "requests" && pending.length > 0 && (
                <span style={{ position: "absolute", top: 6, right: 4, width: 7, height: 7, background: "#E11D48", borderRadius: "50%" }} />
              )}
            </button>
          ))}
        </div>

        {/* MEMBERS TAB */}
        {activeTab === "members" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.map(m => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: m.profiles?.profile_photo_url ? `url(${m.profiles.profile_photo_url}) center/cover` : "#E8E8E4",
                  display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600, color: "#555",
                }}>
                  {!m.profiles?.profile_photo_url && (m.profiles?.username || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>@{m.profiles?.username}</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>{m.role}</div>
                </div>
                {m.role !== "owner" && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {isOwner && (
                      <select
                        value={m.role}
                        disabled={actionLoading === m.user_id + "role"}
                        onChange={e => handleRoleChange(m.user_id, e.target.value)}
                        style={{ border: "1.5px solid #E8E8E4", borderRadius: 6, padding: "5px 8px", fontSize: 12, background: "white", cursor: "pointer", fontFamily: "inherit" }}>
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                      </select>
                    )}
                    <button
                      disabled={actionLoading === m.user_id + "remove"}
                      onClick={() => handleRemoveMember(m.user_id)}
                      style={{ background: "none", border: "1.5px solid #FECACA", color: "#DC2626", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === "requests" && (
          <div>
            {pending.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 14 }}>
                No pending requests.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pending.map(p => (
                  <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                      background: p.profiles?.profile_photo_url ? `url(${p.profiles.profile_photo_url}) center/cover` : "#E8E8E4",
                      display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600, color: "#555",
                    }}>
                      {!p.profiles?.profile_photo_url && (p.profiles?.username || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>@{p.profiles?.username}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        disabled={!!actionLoading}
                        onClick={() => handleRequest(p.user_id, "approve")}
                        style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Approve
                      </button>
                      <button
                        disabled={!!actionLoading}
                        onClick={() => handleRequest(p.user_id, "deny")}
                        style={{ background: "white", color: "#888", border: "1.5px solid #E8E8E4", borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MEETS TAB */}
        {activeTab === "meets" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <label style={lbl}>Link a meet</label>
              <input value={meetSearch} onChange={e => setMeetSearch(e.target.value)}
                placeholder="Search approved meets by title..." style={inp} />
              {meetSearch.trim() && (
                <div style={{ marginTop: 8, border: "1.5px solid #E8E8E4", borderRadius: 10, overflow: "hidden", background: "white" }}>
                  {meetResults.length === 0 ? (
                    <div style={{ padding: "12px 14px", fontSize: 13, color: "#aaa" }}>No matching meets found.</div>
                  ) : meetResults.slice(0, 8).map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderBottom: "1px solid #F0EFEB" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                        <div style={{ fontSize: 12, color: "#aaa" }}>{m.city}{m.date ? ` · ${new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</div>
                      </div>
                      <button onClick={() => handleLinkMeet(m.id)} disabled={linkingId === m.id}
                        style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, opacity: linkingId === m.id ? 0.6 : 1 }}>
                        {linkingId === m.id ? "..." : "Link"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Linked meets</div>
            {linkedMeets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#aaa", fontSize: 14 }}>No meets linked yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {linkedMeets.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>{m.city}{m.date ? ` · ${new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</div>
                    </div>
                    <button onClick={() => handleUnlinkMeet(m.id)} disabled={linkingId === m.id}
                      style={{ background: "none", border: "1.5px solid #FECACA", color: "#DC2626", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0, opacity: linkingId === m.id ? 0.6 : 1 }}>
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div style={{ maxWidth: 600 }}>
            {/* Banner upload */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Banner Image</label>
              <div style={{
                height: 120, borderRadius: 10, border: "1.5px dashed #E8E8E4",
                background: bannerUrl ? `url(${bannerUrl}) center/cover` : "#F5F5F3",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", overflow: "hidden", position: "relative",
              }}
                onClick={() => document.getElementById("banner-upload").click()}>
                {!bannerUrl && <span style={{ fontSize: 13, color: "#bbb" }}>📷 Click to upload banner</span>}
                {bannerUrl && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "white", fontSize: 13 }}>{bannerUploading ? "Uploading..." : "Click to change"}</span>
                </div>}
              </div>
              <input id="banner-upload" type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => handleUpload(e.target.files[0], "profile-banners", setBannerUrl, setBannerUploading)} />
            </div>

            {/* Avatar upload */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Group Avatar</label>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 12, border: "1.5px dashed #E8E8E4",
                  background: avatarUrl ? `url(${avatarUrl}) center/cover` : "#F5F5F3",
                  display: "grid", placeItems: "center", cursor: "pointer", fontSize: 22,
                }}
                  onClick={() => document.getElementById("avatar-upload").click()}>
                  {!avatarUrl && "🏁"}
                </div>
                <div style={{ fontSize: 13, color: "#aaa" }}>{avatarUploading ? "Uploading..." : "Click to upload"}</div>
              </div>
              <input id="avatar-upload" type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => handleUpload(e.target.files[0], "profile-photos", setAvatarUrl, setAvatarUploading)} />
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={lbl}>Group Name</label>
                <input value={name} onChange={e => setName(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  style={{ ...inp, height: 90, resize: "vertical" }} />
              </div>
              <div>
                <label style={lbl}>Location (city, state, or region)</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Hampton Roads, VA" style={inp} />
              </div>
              {isOwner && (
                <div>
                  <label style={lbl}>Privacy</label>
                  <select value={privacy} onChange={e => setPrivacy(e.target.value)} style={inp}>
                    <option value="public">Public — anyone can join</option>
                    <option value="private">Private — approval required</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={handleSaveSettings} disabled={saving}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              {saveSuccess && <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 500 }}>✓ Saved</span>}
            </div>

            {/* Danger zone */}
            {isOwner && (
              <div style={{ marginTop: 48, borderTop: "1px solid #FECACA", paddingTop: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#DC2626", marginBottom: 8 }}>Danger Zone</div>
                <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>Deleting this group is permanent and cannot be undone. All members will be removed.</p>
                <button onClick={handleDeleteGroup}
                  style={{ background: "white", color: "#DC2626", border: "1.5px solid #FECACA", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Delete Group
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
