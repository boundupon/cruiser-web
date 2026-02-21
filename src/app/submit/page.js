// ─────────────────────────────────────────────────────────────────────────────
// FILE: ~/cruiser-web/src/app/submit/page.js
// Changes: Added is_free, ticket_link, parking_info fields to form + DB schema
// ─────────────────────────────────────────────────────────────────────────────

"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const EVENT_TYPES = ["casual", "show", "cruise", "track", "registration"];

const INITIAL = {
  title: "",
  city: "",
  state: "",
  location: "",
  date: "",
  time: "",
  event_type: "casual",
  host_name: "",
  host_contact: "",
  // NEW
  is_free: true,
  ticket_link: "",
  parking_info: "",
};

export default function SubmitMeet() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setForm((f) => ({
          ...f,
          host_contact: u.email,
          host_name:
            u.user_metadata?.full_name ?? f.host_name,
        }));
      }
    });
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // 1. Geocode location
      let lat = null, lng = null;
      const geoQuery = `${form.location}, ${form.city}, ${form.state}`;
      const geoResp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const geoData = await geoResp.json();
      if (geoData[0]) {
        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
      }

      // 2. Upload photo
      let photo_url = null;
      if (photo) {
        const ext = photo.name.split(".").pop();
        const path = `${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("meet-photos")
          .upload(path, photo);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("meet-photos")
          .getPublicUrl(path);
        photo_url = urlData.publicUrl;
      }

      // 3. Insert
      const { error: insertErr } = await supabase.from("meets").insert({
        ...form,
        lat,
        lng,
        photo_url,
        status: "pending",
        user_id: user?.id ?? null,
      });
      if (insertErr) throw insertErr;

      setSuccess(true);
    } catch (err) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success)
    return (
      <PageShell>
        <div className="success-screen">
          <div className="success-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2>Submitted</h2>
          <p>Your meet has been submitted for review. You'll hear back within 24 hours.</p>
          {user && (
            <a href="/my-submissions" className="btn btn-primary" style={{ marginTop: 20 }}>
              View my submissions
            </a>
          )}
          <a href="/" className="btn btn-outline" style={{ marginTop: 10 }}>
            Back to meets
          </a>
        </div>
      </PageShell>
    );

  return (
    <PageShell>
      <style>{`
        .submit-header { margin-bottom: 32px; }
        .submit-header h1 { font-size: 26px; font-weight: 700; letter-spacing: -.6px; margin-bottom: 6px; }
        .submit-header p { font-size: 14px; color: var(--muted); }

        .form-section { margin-bottom: 28px; }
        .form-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
        .form-grid { display: grid; gap: 14px; }
        .form-grid-2 { grid-template-columns: 1fr 1fr; }
        .form-grid-3 { grid-template-columns: 1fr 1fr 1fr; }

        .field { display: flex; flex-direction: column; gap: 5px; }
        .field label { font-size: 12px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
        .field input, .field select, .field textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; font-family: inherit; background: var(--white); color: var(--ink); outline: none; transition: border-color .15s; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--ink); }
        .field textarea { resize: vertical; min-height: 80px; }

        /* Toggle */
        .toggle-group { display: flex; gap: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .toggle-opt { flex: 1; padding: 9px 12px; font-size: 13px; font-weight: 500; border: none; cursor: pointer; font-family: inherit; background: var(--white); color: var(--muted); transition: background .12s, color .12s; text-align: center; }
        .toggle-opt.active { background: var(--ink); color: #fff; }
        .toggle-opt + .toggle-opt { border-left: 1px solid var(--border); }

        /* Photo upload */
        .photo-upload { border: 2px dashed var(--border); border-radius: 10px; padding: 28px; text-align: center; cursor: pointer; transition: border-color .15s; position: relative; overflow: hidden; }
        .photo-upload:hover { border-color: var(--ink); }
        .photo-upload input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
        .photo-upload-preview { width: 100%; height: 180px; object-fit: cover; border-radius: 8px; }
        .photo-upload-text { font-size: 14px; color: var(--muted); }
        .photo-upload-text strong { color: var(--ink); }

        .form-error { background: #fff5f5; border: 1px solid #f5c6cb; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #c0392b; margin-bottom: 16px; }

        .submit-actions { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
        .btn { display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: opacity .15s; }
        .btn:hover { opacity: .85; }
        .btn:disabled { opacity: .5; cursor: default; }
        .btn-primary { background: var(--ink); color: #fff; }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--ink); }

        .success-screen { text-align: center; padding: 60px 0; }
        .success-icon { width: 60px; height: 60px; background: var(--ink); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .success-screen h2 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .success-screen p { font-size: 15px; color: var(--muted); max-width: 360px; margin: 0 auto; }

        @media (max-width: 580px) {
          .form-grid-2, .form-grid-3 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="submit-header">
        <h1>Submit a meet</h1>
        <p>All submissions are reviewed before going live, usually within 24 hours.</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* EVENT DETAILS */}
        <div className="form-section">
          <div className="form-section-title">Event details</div>
          <div className="form-grid">
            <div className="field">
              <label>Event title *</label>
              <input name="title" value={form.title} onChange={handleChange} required placeholder="Sunday Sunrise Cruise" />
            </div>
            <div className="form-grid form-grid-3">
              <div className="field">
                <label>Date *</label>
                <input type="date" name="date" value={form.date} onChange={handleChange} required />
              </div>
              <div className="field">
                <label>Time *</label>
                <input type="time" name="time" value={form.time} onChange={handleChange} required />
              </div>
              <div className="field">
                <label>Event type</label>
                <select name="event_type" value={form.event_type} onChange={handleChange}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* LOCATION */}
        <div className="form-section">
          <div className="form-section-title">Location</div>
          <div className="form-grid">
            <div className="field">
              <label>Venue / address *</label>
              <input name="location" value={form.location} onChange={handleChange} required placeholder="2701 Atlantic Ave" />
            </div>
            <div className="form-grid form-grid-2">
              <div className="field">
                <label>City *</label>
                <input name="city" value={form.city} onChange={handleChange} required placeholder="Virginia Beach" />
              </div>
              <div className="field">
                <label>State *</label>
                <input name="state" value={form.state} onChange={handleChange} required placeholder="VA" maxLength={2} />
              </div>
            </div>
          </div>
        </div>

        {/* ADMISSION & PARKING — NEW */}
        <div className="form-section">
          <div className="form-section-title">Admission and parking</div>
          <div className="form-grid">
            <div className="field">
              <label>Admission</label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-opt${form.is_free ? " active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, is_free: true, ticket_link: "" }))}
                >
                  Free
                </button>
                <button
                  type="button"
                  className={`toggle-opt${!form.is_free ? " active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, is_free: false }))}
                >
                  Paid / registration
                </button>
              </div>
            </div>

            {!form.is_free && (
              <div className="field">
                <label>Ticket / registration link</label>
                <input
                  type="url"
                  name="ticket_link"
                  value={form.ticket_link}
                  onChange={handleChange}
                  placeholder="https://..."
                />
              </div>
            )}

            <div className="field">
              <label>Parking info</label>
              <textarea
                name="parking_info"
                value={form.parking_info}
                onChange={handleChange}
                placeholder="Free parking in the main lot. Overflow parking on Deck B."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* HOST INFO */}
        <div className="form-section">
          <div className="form-section-title">Host info</div>
          <div className="form-grid form-grid-2">
            <div className="field">
              <label>Your name *</label>
              <input name="host_name" value={form.host_name} onChange={handleChange} required placeholder="Alex M." />
            </div>
            <div className="field">
              <label>Contact (email or IG) *</label>
              <input name="host_contact" value={form.host_contact} onChange={handleChange} required placeholder="@username or email" />
            </div>
          </div>
        </div>

        {/* PHOTO */}
        <div className="form-section">
          <div className="form-section-title">Event photo</div>
          <div className="photo-upload">
            <input type="file" accept="image/*" onChange={handlePhoto} />
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="photo-upload-preview" />
            ) : (
              <p className="photo-upload-text">
                <strong>Click to upload</strong> or drag and drop<br />
                <span style={{ fontSize: 12 }}>JPG, PNG, WEBP up to 5MB</span>
              </p>
            )}
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="submit-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit meet"}
          </button>
          <a href="/" className="btn btn-outline">Cancel</a>
        </div>
      </form>
    </PageShell>
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
        .page { max-width: 680px; margin: 0 auto; padding: 48px 24px 80px; }
      `}</style>
      <nav className="nav">
        <a href="/" className="nav-logo">Cruiser</a>
        <a href="/" style={{ fontSize: 13, color: "var(--muted)" }}>Back to meets</a>
      </nav>
      <main className="page">{children}</main>
    </>
  );
}
