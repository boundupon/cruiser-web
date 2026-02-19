"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// simple local thumbnails (optional). If missing, UI falls back gracefully.
const THUMB_BY_ID = {
  1: "/events/1.jpg",
  2: "/events/2.jpg",
  3: "/events/3.jpg",
};

function formatDatePretty(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function Home() {
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [city, setCity] = useState("All Cities");
  const [type, setType] = useState("All Types");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // pagination (Bubble-style footer)
  const PAGE_SIZE = 6;
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_BASE}/meets`, { cache: "no-store" });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setMeets(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e?.message || "Failed to load meets");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const cities = useMemo(() => {
    const set = new Set(meets.map((m) => m.city).filter(Boolean));
    return ["All Cities", ...Array.from(set)];
  }, [meets]);

  // Since your backend doesn’t have `type` yet, we keep the dropdown for the Bubble layout,
  // but it won’t filter until you add type to the API.
  const types = ["All Types", "Cars & Coffee", "Night Meet", "Cruise", "Show", "Track Day"];

  const filtered = useMemo(() => {
    let list = [...meets];

    // city filter
    if (city !== "All Cities") {
      list = list.filter((m) => (m.city || "").toLowerCase() === city.toLowerCase());
    }

    // search filter
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((m) => {
        const hay = `${m.title || ""} ${m.city || ""} ${m.date || ""}`.toLowerCase();
        return hay.includes(needle);
      });
    }

    // date range filter (ISO date string in backend)
    if (dateFrom) {
      list = list.filter((m) => (m.date || "") >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((m) => (m.date || "") <= dateTo);
    }

    // type filter (placeholder until backend supports it)
    if (type !== "All Types") {
      // no-op for now (keeps layout consistent with Bubble)
      // later: list = list.filter(m => (m.type||"").toLowerCase() === type.toLowerCase())
    }

    return list;
  }, [meets, city, q, dateFrom, dateTo, type]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  // reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [q, city, type, dateFrom, dateTo]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      {/* NAVBAR (Bubble-style) */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B1220]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3"
            aria-label="Go to home"
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
              <span className="text-lg font-black tracking-tight">C</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Cruiser</div>
              <div className="text-xs text-white/60">Car meets, organized.</div>
            </div>
          </button>

          <nav className="hidden items-center gap-6 text-sm text-white/80 md:flex">
            <a className="hover:text-white" href="#events">
              Events
            </a>
            <a className="hover:text-white" href="#submit">
              Submit Event
            </a>
            <a className="hover:text-white" href="#about">
              About
            </a>
            <a className="hover:text-white" href="#admin">
              Admin
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="hidden rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10 md:inline-flex">
              Sign in
            </button>
            <button className="rounded-lg bg-[#F59E0B] px-3 py-2 text-sm font-semibold text-black hover:brightness-110">
              Create account
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="relative h-[340px] w-full overflow-hidden md:h-[420px]">
          {/* hero image */}
          <img
            src="/hero.jpeg"
            alt="Car meet hero"
            className="h-full w-full object-cover"
            onError={(e) => {
              // if hero.jpeg isn't present, fall back to a dark gradient
              e.currentTarget.style.display = "none";
            }}
          />
          {/* overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-[#0B1220]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.18),transparent_60%)]" />

          {/* hero content */}
          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl flex-col justify-center px-5 pb-10 pt-10">
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-5xl">
                Discover Local Car Meets &amp; Events
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">
                Find the best car shows, cruises, and gatherings near you—without digging through 10 groups.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button className="rounded-lg bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-black hover:brightness-110">
                  Submit Your Event
                </button>
                <button className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/10">
                  Browse Events
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FILTER BAR (Bubble-style panel) */}
        <div className="-mt-0 pb-10">
          <div className="mx-auto max-w-6xl px-5">
            <div className="rounded-xl border border-white/10 bg-[#0F1B2D] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="grid gap-3 p-4 md:grid-cols-12 md:items-end">
                <div className="md:col-span-4">
                  <label className="text-xs text-white/70">Search Events</label>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder='Try: "Norfolk", "Cars & Coffee", "2026-02-20"'
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#F59E0B]/60 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-white/70">Event Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-[#F59E0B]/60 focus:outline-none"
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-white/70">City</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-[#F59E0B]/60 focus:outline-none"
                  >
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-white/70">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-[#F59E0B]/60 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-white/70">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-[#F59E0B]/60 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-12 mt-1 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    {loading ? (
                      <span className="rounded-full bg-white/10 px-2 py-1">Loading…</span>
                    ) : error ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-200">
                        API error (check backend): {error}
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-1">
                        Showing {filtered.length} meet{filtered.length === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="hidden text-white/35 md:inline">
                      API: {API_BASE} • UI: {typeof window !== "undefined" ? window.location.origin : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setQ("");
                        setCity("All Cities");
                        setType("All Types");
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
                    >
                      Clear All
                    </button>

                    <button
                      onClick={() => window.open(`${API_BASE}/meets`, "_blank", "noopener,noreferrer")}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
                    >
                      Open API JSON →
                    </button>

                    <button
                      onClick={() => {
                        // purely visual “Search” action — filtering already happens live
                        document.getElementById("events")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="rounded-lg bg-[#F59E0B] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 px-4 py-3">
                <div className="text-xs text-white/55">
                  Tip: This matches Bubble’s “hero + filter panel + results grid” layout. Next we’ll add event
                  images/types from the backend.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS */}
      <section id="events" className="mx-auto max-w-6xl px-5 pb-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Upcoming Events</h2>
            <p className="mt-1 text-sm text-white/65">
              Showing approved upcoming events
              {filtered.length ? ` • Page ${pageSafe} of ${totalPages}` : ""}
            </p>
          </div>

          <div className="hidden text-sm text-white/60 md:block">
            {filtered.length ? `Showing ${Math.min(filtered.length, PAGE_SIZE)} of ${filtered.length}` : "—"}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[280px] animate-pulse rounded-xl border border-white/10 bg-white/5"
                />
              ))}
            </>
          )}

          {!loading && !error && paged.length === 0 && (
            <div className="col-span-full rounded-xl border border-white/10 bg-white/5 p-6 text-white/75">
              No events match your filters.
            </div>
          )}

          {!loading &&
            !error &&
            paged.map((m) => {
              const thumb = THUMB_BY_ID[m.id] || "";
              return (
                <article
                  key={m.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-[#0F1B2D] hover:border-white/20"
                >
                  {/* thumbnail */}
                  <div className="relative h-36 w-full bg-gradient-to-br from-white/5 to-white/0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={m.title || "Event"}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full bg-black/45 px-2 py-1 text-xs text-white/85 ring-1 ring-white/15">
                      {m.city || "City"}
                    </div>
                    <div className="absolute right-3 top-3 rounded-full bg-black/45 px-2 py-1 text-xs text-white/85 ring-1 ring-white/15">
                      {m.date || "Date"}
                    </div>
                  </div>

                  {/* content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold leading-tight">{m.title || "Untitled Meet"}</h3>
                        <p className="mt-1 text-sm text-white/65">
                          {m.city || "—"} • {formatDatePretty(m.date)}
                        </p>
                      </div>

                      <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
                        ID: {m.id}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm text-white/70">
                      A curated meet listing. Next step: add real venue, host, RSVP, and images from the database.
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <a
                        href={`${API_BASE}/meets/${m.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-[#F59E0B] hover:brightness-110"
                      >
                        View Details →
                      </a>

                      <button className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10">
                        Save
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>

        {/* Pagination bar (Bubble-ish) */}
        {!loading && !error && filtered.length > PAGE_SIZE && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/70">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10 disabled:opacity-40"
              disabled={pageSafe === 1}
            >
              ← Previous
            </button>

            {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
              const n = i + 1;
              const active = n === pageSafe;
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={[
                    "h-9 w-9 rounded-lg border px-0 py-2",
                    active
                      ? "border-[#F59E0B]/60 bg-[#F59E0B] text-black"
                      : "border-white/15 bg-white/5 hover:bg-white/10",
                  ].join(" ")}
                >
                  {n}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 hover:bg-white/10 disabled:opacity-40"
              disabled={pageSafe === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#0B1220] py-10">
        <div className="mx-auto max-w-6xl px-5 text-sm text-white/55">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>© {new Date().getFullYear()} Cruiser</div>
            <div className="flex items-center gap-4">
              <a className="hover:text-white" href="#about">
                About
              </a>
              <a className="hover:text-white" href="#events">
                Find Event
              </a>
              <a className="hover:text-white" href="#submit">
                Submit
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
