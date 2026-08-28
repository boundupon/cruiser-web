import MeetDetailClient from "./MeetDetailClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const res = await fetch(`${API_BASE}/meets/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Meet not found");
    const meet = await res.json();

    const title = meet.title || "Car Meet";
    const description = [meet.event_type, meet.city, meet.date]
      .filter(Boolean)
      .join(" · ") || "Car meet on Cruiser Meets";
    const images = meet.photo_url ? [meet.photo_url] : ["/hero.jpg"];

    return {
      title,
      description,
      openGraph: { title, description, images, type: "website" },
      twitter: { card: "summary_large_image", title, description, images },
    };
  } catch {
    return { title: "Meet" };
  }
}

export default function Page() {
  return <MeetDetailClient />;
}
