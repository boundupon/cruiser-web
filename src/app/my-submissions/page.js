"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const STATUS_CONFIG = {
  approved: { label: "Approved", bg: "#f0faf4", color: "#1a6b3a", border: "#c3e6cb" },
  pending:  { label: "Pending review", bg: "#fffbf0", color: "#92600a", border: "#fde68a" },
  rejected: { label: "Rejected", bg: "#fff5f5", color: "#c0392b", border: "#f5c6cb" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.color,
          display: "inline-block",
        }}
      />
      {cfg.label}
    </span>
  );
}

export default function MySubmissions() {
  const [user, setUser] = useState(null);
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await loadMeets(u.id, u.email);
      setLoading(false);
    });
  }, []);

  async function loadMeets(userId, email) {
    // Meets are linked to host by user_id OR by host_contact email (for pre-auth submissions)
    const { data, error } = await supabase
      .from("meets")
      .select("*")
      .or(`user_id.eq.${userId},host_contact.eq.${email}`)
      .order("created_at", { ascending: false });

    if (!error && data) setMeets(data);
  }

  async function deleteMeet(id) {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    const { error } = await supabase.from("meets").delete().eq("id", id);
    if (!error) setMeets((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <PageShell><p className="muted-sm">Loading...</p></PageShell>;

  if (!user)
    return (
      <PageShell>
        <div className="empty-state">
          <p>Sign in to view your submitted meets.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
            Go home
          </Link>
        </div>
      </PageShell>
    );

  const approved = meets.filter((m) => m.status === "approved");
  const pending  = meets.filter((m) => m.status === "pending");
  const rejected = meets.filter((m) => m.status === "rejected");

  return (
    <PageShell>
      <style>{`
        .submissions-header { margin-bottom: 32px; }
        .submissions-header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.8px; margin-bottom: 6px; }
        .submissions-header p  { font-size: 14px; color: var(--muted); }

        .summary-row { display: flex; gap: 12px; margin-bottom: 36px; flex-wrap: wrap; }
        .summary-chip { padding: 8px 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--white); font-size: 13px; }
        .summary-chip strong { font-weight: 700; }

        .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin-bottom: 12px; }

        .meet-row { display: flex; align-items: flex-start; gap: 16px; padding: 18px; background: var(--white); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; }
        .meet-row-thumb { width: 72px; height: 56px; border-radius: 6px; object-fit: cover; background: var(--border); flex-shrink: 0; }
        .meet-row-thumb-placeholder { width: 72px; height: 56px; border-radius: 6px; background: var(--border); flex-shrink: 0; }
        .meet-row-info { flex: 1; min-width: 0; }
        .meet-row-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meet-row-meta  { font-size: 13px; color: var(--muted); margin-bottom: 6px; }
        .meet-row-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

        .btn { display: inline-flex; align-items: center; border: none; border-radius: 7px; padding: 7px 14px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: opacity .15s; }
        .btn:hover { opacity: .8; }
        .btn-primary { background: var(--ink); color: #fff; }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--ink); }
        .btn-danger  { background: #fff5f5; border: 1px solid #f5c6cb; color: #c0392b; }

        .empty-section { padding: 24px; background: var(--white); border: 1px dashed var(--border); border-radius: 10px; text-align: center; margin-bottom: 10px; }
        .empty-section p { font-size: 13px; color: var(--muted); }

        .section-group { margin-bottom: 36px; }

        .empty-state { text-align: center; padding: 80px 0; color: var(--muted); }
        .muted-sm { font-size: 14px; color: var(--muted); }

        .rejection-note { font-size: 12px; color: #c0392b; margin-top: 4px; }

        @media (max-width: 560px) {
          .meet-row { flex-direction: column; }
          .meet-row-actions { width: 100%; }
          .summary-row { gap: 8px; }
        }
      `}</style>

      <div className="submissions-header">
        <h1>My submissions</h1>
        <p>Track the status of meets you've submitted.</p>
      </div>

      {meets.length === 0 ? (
        <div className="empty-state">
          <p style={{ marginBottom: 16 }}>You haven't submitted any meets yet.</p>
          <Link href="/submit" className="btn btn-primary">
            Submit a meet
          </Link>
        </div>
      ) : (
        <>
          <div className="summary-row">
            <div className="summary-chip"><strong>{meets.length}</strong> total</div>
            <div className="summary-chip"><strong>{approved.length}</strong> approved</div>
            <div className="summary-chip"><strong>{pending.length}</strong> pending</div>
            {rejected.length > 0 && (
              <div className="summary-chip"><strong>{rejected.length}</strong> rejected</div>
            )}
          </div>

          {pending.length > 0 && (
            <div className="section-group">
              <div className="section-label">Pending review</div>
              {pending.map((m) => <MeetRow key={m.id} meet={m} onDelete={deleteMeet} />)}
            </div>
          )}

          {approved.length > 0 && (
            <div className="section-group">
              <div className="section-label">Approved</div>
              {approved.map((m) => <MeetRow key={m.id} meet={m} onDelete={deleteMeet} />)}
            </div>
          )}

          {rejected.length > 0 && (
            <div className="section-group">
              <div className="section-label">Rejected</div>
              {rejected.map((m) => <MeetRow key={m.id} meet={m} onDelete={deleteMeet} />)}
            </div>
          )}

          <Link href="/submit" className="btn btn-outline">
            Submit another meet
          </Link>
        </>
      )}
    </PageShell>
  );
}

function MeetRow({ meet, onDelete }) {
  const date = meet.date
    ? new Date(meet.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      })
    : "—";

  return (
    <div className="meet-row">
      {meet.photo_url ? (
        <img src={meet.photo_url} alt={meet.title} className="meet-row-thumb" />
      ) : (
        <div className="meet-row-thumb-placeholder" />
      )}
      <div className="meet-row-info">
        <div className="meet-row-title">{meet.title}</div>
        <div className="meet-row-meta">
          {meet.city}, {meet.state} &middot; {date} &middot; {meet.time}
        </div>
        <StatusBadge status={meet.status} />
        {meet.status === "rejected" && meet.rejection_reason && (
          <p className="rejection-note">Note: {meet.rejection_reason}</p>
        )}
        {meet.status === "pending" && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Usually reviewed within 24 hours.
          </p>
        )}
      </div>
      <div className="meet-row-actions">
        {meet.status === "approved" && (
          <Link href={`/meets/${meet.id}`} className="btn btn-outline">
            View
          </Link>
        )}
        {(meet.status === "pending" || meet.status === "rejected") && (
          <Link href={`/submit/edit/${meet.id}`} className="btn btn-outline">
            Edit
          </Link>
        )}
        <button className="btn btn-danger" onClick={() => onDelete(meet.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}

function PageShell({ children }) {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --ink: #1a1a1a; --bg: #FAFAF9; --border: #E8E8E4; --white: #ffffff; --muted: #6b6b6b; }
        html { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--ink); }
        a { text-decoration: none; color: inherit; }
        .nav { position: sticky; top: 0; z-index: 100; background: var(--white); border-bottom: 1px solid var(--border); padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
        .nav-logo { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
        .page { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
      `}</style>
      <nav className="nav">
        <Link href="/" className="nav-logo">Cruiser</Link>
        <Link href="/" style={{ fontSize: 13, color: "var(--muted)" }}>Back to meets</Link>
      </nav>
      <main className="page">{children}</main>
    </>
  );
}
