import {
  listPublishedBusinesses,
  listPublishedTestimonials,
} from "@/db/public-member-submissions";

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type");

  if (type === "businesses") {
    const data = await listPublishedBusinesses();
    return Response.json({ items: data.results || [] });
  }

  if (type === "testimonials") {
    const data = await listPublishedTestimonials();
    return Response.json({ items: data.results || [] });
  }

  return Response.json({ error: "Tipe konten tidak valid." }, { status: 400 });
}
