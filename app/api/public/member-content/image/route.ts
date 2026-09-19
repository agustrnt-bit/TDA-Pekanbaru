import { env } from "cloudflare:workers";
import { getAttendanceFile } from "@/db/attendance";

export async function GET(request:Request) {
  const u=new URL(request.url);
  const id=Number(u.searchParams.get("id"));
  const type=u.searchParams.get("type");

  if(!env.DB || !id) return new Response("Tidak ditemukan",{status:404});

  const item:any=await env.DB.prepare(`
    SELECT logo_key AS logoKey, logo_type AS logoType,
      business_photo_key AS businessKey, business_photo_type AS businessType,
      profile_photo_key AS profileKey, profile_photo_type AS profileType,
      publish_business AS publishBusiness,
      publish_testimonial AS publishTestimonial
    FROM public_member_submissions WHERE id=? LIMIT 1
  `).bind(id).first();

  const media:any={
    logo:[item?.logoKey,item?.logoType,item?.publishBusiness],
    business:[item?.businessKey,item?.businessType,item?.publishBusiness],
    profile:[item?.profileKey,item?.profileType,item?.publishTestimonial],
  };

  const [key,mime,published]=media[type||""]||[];
  if(!key || !published) return new Response("Tidak ditemukan",{status:404});

  const file=await getAttendanceFile(key);
  if(!file) return new Response("Tidak ditemukan",{status:404});

  return new Response(file.body,{
    headers:{"content-type":mime||"image/jpeg","cache-control":"public, max-age=300"}
  });
}
