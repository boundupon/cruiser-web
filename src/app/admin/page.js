"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import AuthModal from "../AuthModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function formatDatePretty(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

const CONTENT_LABELS = {
  comment: "Comment",
  meet_post: "Meet update",
  post: "Profile post",
  vehicle_photo: "Vehicle photo",
};

export default function AdminPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [tab, setTab] = useState("meets");

  const [meets, setMeets] = useState([]);
  const [meetsLoading, setMeetsLoading] = useState(false);
  const [meetsError, setMeetsError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.access_token) checkAdmin(session.access_token);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.access_token) checkAdmin(session.access_token);
      else setIsAdmin(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async function checkAdmin(token) {
    setCheckingAdmin(true);
    try {
      const res = await fetch(`${API_BASE}/admin/check`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setIsAdmin(!!data.is_admin);
      if (data.is_admin) {
        loadMeets();
        loadReports();
      }
    } catch {
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  }

  async function loadMeets() {
    setMeetsLoading(true);
    setMeetsError("");
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/meets`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setMeets(await res.json());
    } catch (e) {
      setMeetsError(e?.message || "Failed to load");
    } finally {
      setMeetsLoading(false);
    }
  }

  async function updateMeetStatus(id, status) {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/meets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      setMeets((prev) => prev.filter((m) => m.id !== id));
      setActionMsg(`Meet ${status} ✓`);
      setTimeout(() => setActionMsg(""), 2500);
    } catch {
      setMeetsError("Action failed. Try again.");
    }
  }

  async function loadReports() {
    setReportsLoading(true);
    setReportsError("");
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/reports`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setReports(await res.json());
    } catch (e) {
      setReportsError(e?.message || "Failed to load");
    } finally {
      setReportsLoading(false);
    }
  }

  async function dismissReport(id) {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/reports/${id}/dismiss`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setReportsError("Action failed. Try again.");
    }
  }

  async function removeContent(id) {
    if (!window.confirm("Remove this content? This cannot be undone.")) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/reports/${id}/content`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      setReports((prev) => prev.filter((r) => r.id !== id));
      setActionMsg("Content removed ✓");
      setTimeout(() => setActionMsg(""), 2500);
    } catch {
      setReportsError("Action failed. Try again.");
    }
  }

  const inp = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9", fontFamily: "inherit" };

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
      `}</style>
      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser Admin</span>
          </a>
          <a href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>Back to site</a>
        </div>
      </header>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 64px" }}>{children}</div>
    </div>
  );

  if (authLoading) return shell(<p style={{ color: "#aaa" }}>Loading...</p>);

  if (!user) {
    return shell(
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        {showAuth && <AuthModal initialTab="signin" onClose={() => setShowAuth(false)} onAuth={(u) => setUser(u)} />}
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Sign in to access admin</div>
        <button onClick={() => setShowAuth(true)}
          style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
          Sign in
        </button>
      </div>
    );
  }

  if (checkingAdmin) return shell(<p style={{ color: "#aaa" }}>Checking access...</p>);

  if (!isAdmin) {
    return shell(
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚫</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Not authorized</div>
        <div style={{ fontSize: 14, color: "#888" }}>Signed in as {user.email}, which doesn't have admin access.</div>
      </div>
    );
  }

  return shell(
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 4, background: "#F0EFEB", borderRadius: 10, padding: 4 }}>
          {[
            { key: "meets", label: `Pending Meets${meets.length ? ` (${meets.length})` : ""}` },
            { key: "reports", label: `Reports${reports.length ? ` (${reports.length})` : ""}` },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ background: tab === t.key ? "white" : "transparent", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, color: tab === t.key ? "#1a1a1a" : "#888", cursor: "pointer", boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => (tab === "meets" ? loadMeets() : loadReports())}
          style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
          Refresh
        </button>
      </div>

      {actionMsg && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#166534", marginBottom: 16 }}>
          {actionMsg}
        </div>
      )}

      {tab === "meets" && (
        <div>
          {meetsError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>{meetsError}</div>}
          {meetsLoading && <p style={{ color: "#aaa", fontSize: 14 }}>Loading...</p>}
          {!meetsLoading && meets.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 15 }}>🎉 No pending meets — all caught up!</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {meets.map((m) => (
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
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => updateMeetStatus(m.id, "approved")}
                    style={{ background: "#16A34A", color: "white", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => updateMeetStatus(m.id, "rejected")}
                    style={{ background: "white", color: "#DC2626", border: "1.5px solid #FCA5A5", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div>
          {reportsError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>{reportsError}</div>}
          {reportsLoading && <p style={{ color: "#aaa", fontSize: 14 }}>Loading...</p>}
          {!reportsLoading && reports.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 15 }}>🎉 No open reports — all caught up!</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reports.map((r) => (
              <div key={r.id} style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 12, padding: "18px 22px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, background: "#F5F5F3", color: "#777", padding: "3px 10px", borderRadius: 100 }}>{CONTENT_LABELS[r.content_type] || r.content_type}</span>
                  <span style={{ fontSize: 12, color: "#aaa" }}>Reported {formatDatePretty(r.created_at)}</span>
                </div>
                {!r.content ? (
                  <div style={{ fontSize: 13, color: "#aaa", fontStyle: "italic", marginBottom: 10 }}>Content already removed.</div>
                ) : (
                  <div style={{ background: "#FAFAF9", border: "1px solid #F0EFEB", borderRadius: 8, padding: "12px 14px", marginBottom: 10, fontSize: 13, color: "#333" }}>
                    {r.content.username && <div style={{ fontWeight: 600, marginBottom: 4 }}>@{r.content.username}</div>}
                    {r.content.body && <div>{r.content.body}</div>}
                    {r.content.caption && <div>{r.content.caption}</div>}
                    {(r.content.photo_url || r.content.media_url) && (
                      <img src={r.content.photo_url || r.content.media_url} alt="" style={{ maxWidth: 200, maxHeight: 150, borderRadius: 6, marginTop: 8, display: "block" }} />
                    )}
                    {(r.content.make || r.content.model) && <div>{r.content.make} {r.content.model}</div>}
                  </div>
                )}
                {r.reason && <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Reason: “{r.reason}”</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => removeContent(r.id)}
                    style={{ background: "white", color: "#DC2626", border: "1.5px solid #FCA5A5", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                    Remove content
                  </button>
                  <button onClick={() => dismissReport(r.id)}
                    style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "8px 18px", fontSize: 13, color: "#555", cursor: "pointer" }}>
                    Dismiss report
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
