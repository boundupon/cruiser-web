"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const EVENT_TYPES = ["Cars & Coffee", "Night Meet", "Cruise", "Show", "Track Day"];

export default function SubmitMeet() {
  const [user, setUser] = useState(null);

  const [hostTitle, setHostTitle] = useState("");
  const [hostCity, setHostCity] = useState("");
  const [hostState, setHostState] = useState("");
  const [hostLocation, setHostLocation] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostContact, setHostContact] = useState("");
  const [hostDate, setHostDate] = useState("");
  const [hostTime, setHostTime] = useState("");
  const [hostEventType, setHostEventType] = useState("Cars & Coffee");
  const [hostDescription, setHostDescription] = useState("");
  const [hostPhotoFile, setHostPhotoFile] = useState(null);
  const [hostPhotoPreview, setHostPhotoPreview] = useState("");
  const [hostPhotoUploading, setHostPhotoUploading] = useState(false);
  const [hostIsFree, setHostIsFree] = useState(true);
  const [hostTicketLink, setHostTicketLink] = useState("");
  const [hostParkingInfo, setHostParkingInfo] = useState("");
  const [hostSubmitting, setHostSubmitting] = useState(false);
  const [hostSuccess, setHostSuccess] = useState(false);
  const [hostError, setHostError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const inp = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1a1a1a", background: "#FAFAF9", fontFamily: "inherit" };
  const inpSm = { width: "100%", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#FAFAF9", outline: "none", fontFamily: "inherit" };
  const lbl = { fontSize: 12, color: "#999", display: "block", marginBottom: 6 };

  async function handleSubmit(e) {
    e.preventDefault();
    setHostSubmitting(true);
    setHostError("");
    try {
      let photoUrl = "";
      let meetLat = null, meetLng = null;

      if (!hostPhotoFile) throw new Error("A photo or flyer is required.");

      try {
        const geoQuery = [hostCity.trim(), hostState.trim()].filter(Boolean).join(", ");
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1&countrycodes=us`,
          { headers: { "Accept-Language": "en" } }
        );
        const geoData = await geoRes.json();
        if (geoData && geoData[0]) {
          meetLat = parseFloat(geoData[0].lat);
          meetLng = parseFloat(geoData[0].lon);
        }
      } catch (e) { console.warn("Geocoding failed:", e); }

      setHostPhotoUploading(true);
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(hostPhotoFile.type)) throw new Error("Only JPEG, PNG, WEBP, and GIF images are allowed.");
      if (hostPhotoFile.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB.");
      const ext = hostPhotoFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be signed in to upload a photo.");
      const { error: uploadError } = await supabase.storage
        .from("meet-photos")
        .upload(fileName, hostPhotoFile, { contentType: hostPhotoFile.type, upsert: false });
      if (uploadError) throw new Error("Photo upload failed: " + uploadError.message);
      const { data: urlData } = supabase.storage.from("meet-photos").getPublicUrl(fileName);
      photoUrl = urlData.publicUrl;
      setHostPhotoUploading(false);

      const res = await fetch(`${API_BASE}/meets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: hostTitle, city: hostCity, state: hostState,
          location: hostLocation, host_name: hostName, host_contact: hostContact,
          date: hostDate, time: hostTime, event_type: hostEventType,
          description: hostDescription, photo_url: photoUrl,
          lat: meetLat, lng: meetLng,
          is_free: hostIsFree, ticket_link: hostTicketLink, parking_info: hostParkingInfo,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error("Submission failed: " + (errBody?.error || res.status));
      }
      setHostSuccess(true);
    } catch (err) {
      setHostError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setHostSubmitting(false);
      setHostPhotoUploading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9", color: "#1a1a1a", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, select, button, textarea { font-family: inherit; }
        ::placeholder { color: #bbb; }
      `}</style>

      <header style={{ borderBottom: "1px solid #ECEAE6", background: "#FAFAF9", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, background: "#1a1a1a", borderRadius: 8, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 14 }}>C</div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1a1a" }}>Cruiser</span>
          </a>
          <a href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>Back to meets</a>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.3px" }}>Host a Meet</h1>
          <p style={{ fontSize: 14, color: "#888", margin: 0 }}>Submit your meet for review. We'll approve it within 24 hours.</p>
        </div>

        <div style={{ background: "white", border: "1.5px solid #E8E8E4", borderRadius: 16, padding: 28, boxShadow: "0 2px 24px rgba(0,0,0,0.05)" }}>
          {!user ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Sign in to host a meet</div>
              <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Create an account to submit your meet for review.</div>
              <a href="/" style={{ background: "#1a1a1a", color: "white", borderRadius: 8, padding: "10px 24px", fontSize: 14, textDecoration: "none", display: "inline-block" }}>
                Sign in on home page
              </a>
            </div>
          ) : hostSuccess ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Meet submitted for review!</div>
              <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>We'll review your meet and approve it shortly.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setHostSuccess(false)}
                  style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>
                  Submit another
                </button>
                <a href="/my-submissions"
                  style={{ background: "none", border: "1.5px solid #E8E8E4", borderRadius: 8, padding: "10px 24px", fontSize: 14, color: "#555", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  View my submissions
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Event title *</label>
                  <input required value={hostTitle} onChange={(e) => setHostTitle(e.target.value)}
                    placeholder="e.g. Sunday Morning Cars and Coffee" style={inp} />
                </div>
                <div>
                  <label style={lbl}>City *</label>
                  <input required value={hostCity} onChange={(e) => setHostCity(e.target.value)}
                    placeholder="e.g. Norfolk" style={inp} />
                </div>
                <div>
                  <label style={lbl}>State *</label>
                  <input required value={hostState} onChange={(e) => setHostState(e.target.value)}
                    placeholder="e.g. VA" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Location / venue</label>
                  <input value={hostLocation} onChange={(e) => setHostLocation(e.target.value)}
                    placeholder="e.g. Waterside District" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Host name *</label>
                  <input required value={hostName} onChange={(e) => setHostName(e.target.value)}
                    placeholder="Your name or group" style={inp} />
                </div>
                <div style={{ gridColumn: "2 / -1" }}>
                  <label style={lbl}>Contact (Instagram, phone, etc)</label>
                  <input value={hostContact} onChange={(e) => setHostContact(e.target.value)}
                    placeholder="e.g. @yourhandle" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Date *</label>
                  <input required type="date" value={hostDate} onChange={(e) => setHostDate(e.target.value)} style={inpSm} />
                </div>
                <div>
                  <label style={lbl}>Time *</label>
                  <input required type="time" value={hostTime} onChange={(e) => setHostTime(e.target.value)} style={inpSm} />
                </div>
                <div>
                  <label style={lbl}>Event type *</label>
                  <select required value={hostEventType} onChange={(e) => setHostEventType(e.target.value)} style={inpSm}>
                    {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Admission + Parking */}
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Admission</label>
                <div style={{ display: "flex", border: "1.5px solid #E8E8E4", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                  <button type="button" onClick={() => { setHostIsFree(true); setHostTicketLink(""); }}
                    style={{ flex: 1, padding: "9px 12px", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer", fontFamily: "inherit", background: hostIsFree ? "#1a1a1a" : "white", color: hostIsFree ? "white" : "#777", transition: "background .12s" }}>
                    Free
                  </button>
                  <button type="button" onClick={() => setHostIsFree(false)}
                    style={{ flex: 1, padding: "9px 12px", fontSize: 13, fontWeight: 500, border: "none", borderLeft: "1.5px solid #E8E8E4", cursor: "pointer", fontFamily: "inherit", background: !hostIsFree ? "#1a1a1a" : "white", color: !hostIsFree ? "white" : "#777", transition: "background .12s" }}>
                    Paid / Registration
                  </button>
                </div>
                {!hostIsFree && (
                  <input value={hostTicketLink} onChange={(e) => setHostTicketLink(e.target.value)}
                    placeholder="Ticket / registration link (https://...)"
                    style={{ ...inp, marginBottom: 10 }} />
                )}
                <input value={hostParkingInfo} onChange={(e) => setHostParkingInfo(e.target.value)}
                  placeholder="Parking info (optional) — e.g. Free lot on site, overflow on Deck B"
                  style={inp} />
              </div>

              {/* Photo */}
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Photo / Flyer <span style={{ color: "#DC2626" }}>*</span></label>
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  border: `2px dashed ${hostPhotoPreview ? "#1a1a1a" : "#E8E8E4"}`, borderRadius: 8,
                  padding: hostPhotoPreview ? 0 : "24px 16px", cursor: "pointer",
                  background: "#FAFAF9", overflow: "hidden", minHeight: hostPhotoPreview ? 160 : "auto", position: "relative",
                }}>
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setHostPhotoFile(file);
                      setHostPhotoPreview(URL.createObjectURL(file));
                    }} />
                  {hostPhotoPreview ? (
                    <>
                      <img src={hostPhotoPreview} alt="preview" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 11, padding: "4px 10px", borderRadius: 6 }}>
                        Click to change
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📷</div>
                      <div style={{ fontSize: 13, color: "#888", textAlign: "center" }}>Click to upload a photo or flyer</div>
                      <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>JPG, PNG, WebP up to 5MB</div>
                    </>
                  )}
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Description</label>
                <textarea value={hostDescription} onChange={(e) => setHostDescription(e.target.value)}
                  placeholder="Tell people about your meet..." rows={3}
                  style={{ ...inp, resize: "vertical" }} />
              </div>

              {hostError && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 12 }}>
                  {hostError}
                </div>
              )}

              <button type="submit" disabled={hostSubmitting}
                style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: hostSubmitting ? "not-allowed" : "pointer", opacity: hostSubmitting ? 0.7 : 1 }}>
                {hostSubmitting ? (hostPhotoUploading ? "Uploading photo..." : "Submitting...") : "Submit for Review"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
