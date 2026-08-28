"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const TYPE_META = {
  car_club:         { label: "Car Club",         color: "#1a1a1a", bg: "#F0EFEB" },
  brand_model:      { label: "Brand / Model",    color: "#1D4ED8", bg: "#EFF6FF" },
  regional_crew:    { label: "Regional Crew",    color: "#065F46", bg: "#ECFDF5" },
  event_organizer:  { label: "Event Organizer",  color: "#92400E", bg: "#FFFBEB" },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function GroupPage() {
  const router = useRouter();
  const { slug } = useParams();

  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [meets, setMeets] = useState([]);
  const [membership, setMembership] = useState({ role: null, status: null });
  const [activeTab, setActiveTab] = useState("feed");
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Feed
  const [posts, setPosts] = useState([]);
  const [postBody, setPostBody] = useState("");
  const [postPhotoFile, setPostPhotoFile] = useState(null);
  const [postPhotoPreview, setPostPhotoPreview] = useState("");
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [profileUsername, setProfileUsername] = useState(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [openPostId, setOpenPostId] = useState(null); // which post's comments are expanded
  const [commentsByPost, setCommentsByPost] = useState({}); // { [postId]: comment[] }
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { postId, commentId, username }
  const [replyBody, setReplyBody] = useState("");
  const [expandedReplies, setExpandedReplies] = useState(new Set());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.access_token) fetchProfileData(session.access_token);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
      if (s?.access_token) fetchProfileData(s.access_token);
      else { setProfileUsername(null); setProfilePhotoUrl(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfileData(token) {
    try {
      const res = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const p = await res.json();
        if (p?.username) setProfileUsername(p.username);
        if (p?.profile_photo_url) setProfilePhotoUrl(p.profile_photo_url);
      }
    } catch { /* silent */ }
  }

  async function loadPosts() {
    const res = await fetch(`${API_BASE}/groups/${slug}/posts`);
    if (!res.ok) return;
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (slug) loadPosts();
  }, [slug]);

  async function loadComments(postId) {
    const res = await fetch(`${API_BASE}/groups/${slug}/posts/${postId}/comments`);
    if (!res.ok) return;
    const data = await res.json();
    setCommentsByPost(prev => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
  }

  function toggleComments(postId) {
    if (openPostId === postId) { setOpenPostId(null); return; }
    setOpenPostId(postId);
    if (!commentsByPost[postId]) loadComments(postId);
  }

  async function handlePostSubmit(e) {
    e.preventDefault();
    if (!postBody.trim()) return;
    setPostSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let photoUrl = null;
      if (postPhotoFile) {
        const ext = postPhotoFile.name.split(".").pop();
        const path = `${user.id}/group-post-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-media").upload(path, postPhotoFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("post-media").getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }
      const res = await fetch(`${API_BASE}/groups/${slug}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ body: postBody.trim(), photo_url: photoUrl }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPosts(prev => [{ ...data, username: profileUsername, profile_photo_url: profilePhotoUrl }, ...prev]);
      setPostBody(""); setPostPhotoFile(null); setPostPhotoPreview("");
    } catch (e) { console.error(e); }
    finally { setPostSubmitting(false); }
  }

  async function handleDeletePost(postId) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/groups/${slug}/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setPosts(prev => prev.filter(p => p.id !== postId));
  }

  async function handleCommentSubmit(e, postId) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setCommentSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/groups/${slug}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ body: commentBody.trim(), username: profileUsername || user.email?.split("@")[0] }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setCommentsByPost(prev => ({ ...prev, [postId]: [...(prev[postId] || []), { ...data, profile_photo_url: profilePhotoUrl }] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p));
      setCommentBody("");
    } catch (e) { console.error(e); }
    finally { setCommentSubmitting(false); }
  }

  function startReply(postId, comment) {
    setReplyingTo({ postId, commentId: comment.id, username: comment.username });
    setReplyBody(`@${comment.username} `);
  }

  async function handleReplySubmit(postId, parentId) {
    if (!replyBody.trim()) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/groups/${slug}/posts/${postId}/comments/${parentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ body: replyBody.trim(), username: profileUsername || user.email?.split("@")[0] }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setCommentsByPost(prev => ({ ...prev, [postId]: [...(prev[postId] || []), { ...data, profile_photo_url: profilePhotoUrl }] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p));
      setReplyBody(""); setReplyingTo(null);
      setExpandedReplies(prev => new Set([...prev, parentId]));
    } catch (e) { console.error(e); }
  }

  async function handleDeleteComment(postId, commentId) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/groups/${slug}/posts/${postId}/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setCommentsByPost(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) - 1) } : p));
    }
  }

  function timeAgoShort(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return timeAgo(iso);
  }

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      try {
        const [gRes, mRes, meetsRes] = await Promise.all([
          fetch(`${API_BASE}/groups/${slug}`),
          fetch(`${API_BASE}/groups/${slug}/members`),
          fetch(`${API_BASE}/groups/${slug}/meets`),
        ]);
        if (!gRes.ok) { setGroup(null); setLoading(false); return; }
        const [g, m, mt] = await Promise.all([gRes.json(), mRes.json(), meetsRes.json()]);
        setGroup(g);
        setMembers(Array.isArray(m) ? m : []);
        setMeets(Array.isArray(mt) ? mt : []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!slug || !user) return;
    async function loadMembership() {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await fetch(`${API_BASE}/groups/${slug}/membership`, { headers });
      if (res.ok) setMembership(await res.json());
    }
    loadMembership();
  }, [slug, user]);

  async function handleJoin() {
    if (!user) { router.push("/"); return; }
    setJoining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/groups/${slug}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setMembership({ role: "member", status: data.status });
      if (data.status === "active") {
        setGroup(prev => ({ ...prev, member_count: prev.member_count + 1 }));
        // Reload members
        const mRes = await fetch(`${API_BASE}/groups/${slug}/members`);
        const mData = await mRes.json();
        setMembers(Array.isArray(mData) ? mData : []);
      }
    } catch (e) { console.error(e); }
    finally { setJoining(false); }
  }

  async function handleLeave() {
    if (!confirm("Leave this group?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${API_BASE}/groups/${slug}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setMembership({ role: null, status: null });
    setGroup(prev => ({ ...prev, member_count: Math.max(0, prev.member_count - 1) }));
    const mRes = await fetch(`${API_BASE}/groups/${slug}/members`);
    const mData = await mRes.json();
    setMembers(Array.isArray(mData) ? mData : []);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: "#aaa", fontSize: 15 }}>Loading group...</div>
    </div>
  );

  if (!group) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 40 }}>🏁</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Group not found</div>
      <button onClick={() => router.push("/groups")} style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
        Browse Groups
      </button>
    </div>
  );

  const meta = TYPE_META[group.type] || TYPE_META.car_club;
  const isOwner = membership?.role === "owner";
  const isMod = membership?.role === "moderator";
  const isActive = membership?.status === "active";
  const isPending = membership?.status === "pending";
  const canManage = isOwner || isMod;
  const owner = members.find(m => m.role === "owner");

  const tabs = [
    { id: "feed", label: `Feed${posts.length > 0 ? ` (${posts.length})` : ""}` },
    { id: "about", label: "About" },
    { id: "members", label: `Members (${members.length})` },
    { id: "meets", label: `Meets (${meets.length})` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
      `}</style>

      {/* NAV */}
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Cruiser</span>
          </button>
          <button onClick={() => router.push("/groups")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1.5px solid #E0E0DC", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#555", cursor: "pointer" }}>
            ← All Groups
          </button>
        </div>
      </header>

      {/* BANNER */}
      <div style={{
        height: isMobile ? 160 : 220,
        background: group.banner_url ? `url(${group.banner_url}) center/cover` : "linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 60%, #555 100%)",
        position: "relative",
      }}>
        {/* Avatar */}
        <div style={{
          position: "absolute", bottom: -32, left: isMobile ? 16 : 32,
          width: 72, height: 72, borderRadius: 14,
          border: "3px solid white",
          background: group.avatar_url ? `url(${group.avatar_url}) center/cover` : "#E8E8E4",
          display: "grid", placeItems: "center",
          fontSize: 28, fontWeight: 700, color: "#555",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        }}>
          {!group.avatar_url && group.name[0].toUpperCase()}
        </div>
      </div>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "0 16px 60px" : "0 20px 80px" }}>

        {/* Group header row */}
        <div style={{ paddingTop: 48, paddingBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>{group.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: meta.color, background: meta.bg, letterSpacing: "0.03em" }}>{meta.label}</span>
              {group.privacy === "private" && (
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: "#555", background: "#F0EFEB" }}>🔒 Private</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#aaa", display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {group.member_count} members
              </span>
              {group.location && <span>📍 {group.location}</span>}
              {owner && <span>Owner: <button onClick={() => router.push(`/u/${owner.profiles?.username}`)} style={{ background: "none", border: "none", padding: 0, color: "#555", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>@{owner.profiles?.username}</button></span>}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {canManage && (
              <button onClick={() => router.push(`/groups/${slug}/manage`)}
                style={{ background: "white", color: "#1a1a1a", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Manage
              </button>
            )}
            {!membership.role && (
              <button onClick={handleJoin} disabled={joining}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: joining ? "not-allowed" : "pointer", opacity: joining ? 0.7 : 1 }}>
                {joining ? "..." : group.privacy === "private" ? "Request to Join" : "Join Group"}
              </button>
            )}
            {isPending && (
              <div style={{ background: "#FFFBEB", color: "#92400E", border: "1.5px solid #FDE68A", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500 }}>
                ⏳ Request pending
              </div>
            )}
            {isActive && !isOwner && (
              <button onClick={handleLeave}
                style={{ background: "white", color: "#888", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>
                Leave
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #ECEAE6", marginBottom: 28, display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                background: "none", border: "none", padding: "10px 16px", fontSize: 14, fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? "#1a1a1a" : "#aaa", cursor: "pointer",
                borderBottom: `2px solid ${activeTab === t.id ? "#1a1a1a" : "transparent"}`,
                marginBottom: -1, transition: "color 0.1s",
              }}>{t.label}</button>
          ))}
        </div>

        {/* Feed tab */}
        {activeTab === "feed" && (
          <div>
            {isActive ? (
              <form onSubmit={handlePostSubmit} style={{ marginBottom: 24 }}>
                <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: 16 }}>
                  <textarea value={postBody} onChange={e => setPostBody(e.target.value)}
                    placeholder="Share something with the group..." rows={3}
                    style={{ width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
                  {postPhotoPreview && (
                    <div style={{ position: "relative", display: "inline-block", marginBottom: 10 }}>
                      <img src={postPhotoPreview} alt="" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8 }} />
                      <button type="button" onClick={() => { setPostPhotoFile(null); setPostPhotoPreview(""); }}
                        style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, background: "#1a1a1a", color: "white", border: "none", borderRadius: "50%", cursor: "pointer", fontSize: 12, display: "grid", placeItems: "center" }}>x</button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button type="submit" disabled={postSubmitting || !postBody.trim()}
                      style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: postSubmitting || !postBody.trim() ? 0.5 : 1 }}>
                      {postSubmitting ? "Posting..." : "Post"}
                    </button>
                    <label style={{ fontSize: 13, color: "#888", cursor: "pointer" }}>
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setPostPhotoFile(f); setPostPhotoPreview(URL.createObjectURL(f)); } }} />
                      Add photo
                    </label>
                  </div>
                </div>
              </form>
            ) : (
              <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: "16px 20px", marginBottom: 24, fontSize: 13, color: "#888" }}>
                {user ? "Join this group to post in the feed." : "Sign in and join this group to post in the feed."}
              </div>
            )}

            {posts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No posts yet</div>
                <div style={{ fontSize: 13, color: "#888" }}>Be the first to share something with the group.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {posts.map(p => {
                  const postComments = commentsByPost[p.id] || [];
                  const topLevel = postComments.filter(c => !c.parent_id);
                  const getReplies = (parentId) => postComments.filter(c => c.parent_id === parentId);
                  const isOpen = openPostId === p.id;
                  return (
                    <div key={p.id} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: "16px" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                        <button onClick={() => router.push(`/u/${p.username}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                          {p.profile_photo_url
                            ? <img src={p.profile_photo_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                            : <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: "50%", display: "grid", placeItems: "center", color: "white", fontSize: 12, fontWeight: 600 }}>{(p.username || "?")[0].toUpperCase()}</div>
                          }
                        </button>
                        <div>
                          <button onClick={() => router.push(`/u/${p.username}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1a1a1a", fontFamily: "inherit" }}>@{p.username || "unknown"}</button>
                          <span style={{ fontSize: 12, color: "#bbb", marginLeft: 8 }}>{timeAgoShort(p.created_at)}</span>
                        </div>
                        {user?.id === p.user_id && (
                          <button onClick={() => handleDeletePost(p.id)}
                            style={{ marginLeft: "auto", background: "none", border: "none", color: "#ccc", fontSize: 16, cursor: "pointer" }}>x</button>
                        )}
                      </div>
                      <p style={{ fontSize: 14, color: "#333", lineHeight: 1.6, margin: "0 0 10px" }}>{p.body}</p>
                      {p.photo_url && (
                        <img src={p.photo_url} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 10, maxHeight: 320, objectFit: "cover" }} />
                      )}
                      <button onClick={() => toggleComments(p.id)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#888", fontSize: 13, fontWeight: 500 }}>
                        {p.comment_count > 0 ? `${p.comment_count} comment${p.comment_count === 1 ? "" : "s"}` : "Comment"}
                      </button>

                      {isOpen && (
                        <div style={{ marginTop: 14, borderTop: "1px solid #F0EFEB", paddingTop: 14 }}>
                          {isActive && (
                            <form onSubmit={e => handleCommentSubmit(e, p.id)} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                              <input value={commentBody} onChange={e => setCommentBody(e.target.value)}
                                placeholder="Write a comment..."
                                style={{ flex: 1, border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                              <button type="submit" disabled={commentSubmitting || !commentBody.trim()}
                                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: commentSubmitting || !commentBody.trim() ? 0.5 : 1 }}>
                                Send
                              </button>
                            </form>
                          )}
                          {topLevel.length === 0 ? (
                            <div style={{ fontSize: 13, color: "#bbb", textAlign: "center", padding: "12px 0" }}>No comments yet.</div>
                          ) : topLevel.map(c => {
                            const replies = getReplies(c.id);
                            const repliesExpanded = expandedReplies.has(c.id);
                            return (
                              <div key={c.id} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", gap: 10 }}>
                                  <button onClick={() => router.push(`/u/${c.username}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                                    {c.profile_photo_url
                                      ? <img src={c.profile_photo_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                                      : <div style={{ width: 28, height: 28, background: "#E8E8E4", borderRadius: "50%", display: "grid", placeItems: "center", color: "#555", fontSize: 11, fontWeight: 600 }}>{(c.username || "?")[0].toUpperCase()}</div>
                                    }
                                  </button>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                      <button onClick={() => router.push(`/u/${c.username}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1a1a1a", fontFamily: "inherit" }}>{c.username}</button>
                                      <span style={{ fontSize: 11, color: "#bbb" }}>{timeAgoShort(c.created_at)}</span>
                                    </div>
                                    <p style={{ fontSize: 13, color: "#333", margin: "2px 0 4px", lineHeight: 1.5, wordBreak: "break-word" }}>{c.body}</p>
                                    <div style={{ display: "flex", gap: 12 }}>
                                      {isActive && (
                                        <button onClick={() => replyingTo?.commentId === c.id ? setReplyingTo(null) : startReply(p.id, c)}
                                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#aaa", fontSize: 12, fontWeight: 500 }}>Reply</button>
                                      )}
                                      {replies.length > 0 && (
                                        <button onClick={() => setExpandedReplies(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#666", fontSize: 12, fontWeight: 500 }}>
                                          {repliesExpanded ? "Hide" : "View"} {replies.length} {replies.length === 1 ? "reply" : "replies"}
                                        </button>
                                      )}
                                      {user?.id === c.user_id && (
                                        <button onClick={() => handleDeleteComment(p.id, c.id)}
                                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#ccc", fontSize: 12 }}>Delete</button>
                                      )}
                                    </div>
                                    {replyingTo?.commentId === c.id && (
                                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                        <input autoFocus value={replyBody} onChange={e => setReplyBody(e.target.value)}
                                          placeholder={`Reply to ${c.username}...`}
                                          style={{ flex: 1, border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                                          onKeyDown={e => { if (e.key === "Enter") handleReplySubmit(p.id, c.id); }} />
                                        <button onClick={() => handleReplySubmit(p.id, c.id)} disabled={!replyBody.trim()}
                                          style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", opacity: !replyBody.trim() ? 0.5 : 1 }}>
                                          Reply
                                        </button>
                                      </div>
                                    )}
                                    {repliesExpanded && replies.length > 0 && (
                                      <div style={{ marginTop: 8, marginLeft: 12, borderLeft: "2px solid #F0EFEB", paddingLeft: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                        {replies.map(r => (
                                          <div key={r.id} style={{ display: "flex", gap: 8 }}>
                                            <button onClick={() => router.push(`/u/${r.username}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                                              {r.profile_photo_url
                                                ? <img src={r.profile_photo_url} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                                                : <div style={{ width: 22, height: 22, background: "#E8E8E4", borderRadius: "50%", display: "grid", placeItems: "center", color: "#555", fontSize: 10, fontWeight: 600 }}>{(r.username || "?")[0].toUpperCase()}</div>
                                              }
                                            </button>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                                <button onClick={() => router.push(`/u/${r.username}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#1a1a1a", fontFamily: "inherit" }}>{r.username}</button>
                                                <span style={{ fontSize: 10, color: "#bbb" }}>{timeAgoShort(r.created_at)}</span>
                                              </div>
                                              <p style={{ fontSize: 12, color: "#333", margin: "1px 0", lineHeight: 1.5, wordBreak: "break-word" }}>{r.body}</p>
                                              {user?.id === r.user_id && (
                                                <button onClick={() => handleDeleteComment(p.id, r.id)}
                                                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#ccc", fontSize: 11 }}>Delete</button>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* About tab */}
        {activeTab === "about" && (
          <div style={{ maxWidth: 600 }}>
            {group.description ? (
              <p style={{ fontSize: 15, color: "#444", lineHeight: 1.7, margin: "0 0 24px" }}>{group.description}</p>
            ) : (
              <p style={{ fontSize: 14, color: "#aaa", fontStyle: "italic" }}>No description yet.</p>
            )}
            <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span style={{ color: "#aaa", minWidth: 80 }}>Type</span>
                <span style={{ fontWeight: 500, color: meta.color }}>{meta.label}</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span style={{ color: "#aaa", minWidth: 80 }}>Privacy</span>
                <span style={{ fontWeight: 500 }}>{group.privacy === "private" ? "🔒 Private" : "🌐 Public"}</span>
              </div>
              {group.location && (
                <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                  <span style={{ color: "#aaa", minWidth: 80 }}>Location</span>
                  <span style={{ fontWeight: 500 }}>📍 {group.location}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span style={{ color: "#aaa", minWidth: 80 }}>Founded</span>
                <span style={{ fontWeight: 500 }}>{new Date(group.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Members tab */}
        {activeTab === "members" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.length === 0 ? (
              <div style={{ color: "#aaa", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No members yet.</div>
            ) : members.map(m => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: "1.5px solid #E8E8E4", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: m.profiles?.profile_photo_url ? `url(${m.profiles.profile_photo_url}) center/cover` : "#E8E8E4",
                  display: "grid", placeItems: "center", fontSize: 15, fontWeight: 600, color: "#555", flexShrink: 0,
                }}>
                  {!m.profiles?.profile_photo_url && (m.profiles?.username || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <button onClick={() => router.push(`/u/${m.profiles?.username}`)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
                    @{m.profiles?.username}
                  </button>
                  <div style={{ fontSize: 12, color: "#aaa" }}>Joined {timeAgo(m.joined_at)}</div>
                </div>
                {m.role !== "member" && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, borderRadius: 5, padding: "3px 8px",
                    background: m.role === "owner" ? "#1a1a1a" : "#F0EFEB",
                    color: m.role === "owner" ? "white" : "#555",
                  }}>{m.role === "owner" ? "Owner" : "Mod"}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Meets tab */}
        {activeTab === "meets" && (
          <div>
            {meets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
                <div style={{ fontSize: 15, color: "#888" }}>No meets linked to this group yet.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {meets.map(m => (
                  <div key={m.id} onClick={() => router.push(`/meets/${m.id}`)}
                    style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: "16px", cursor: "pointer", transition: "box-shadow 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                    <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{m.event_type}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 13, color: "#777" }}>{m.city} · {new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
