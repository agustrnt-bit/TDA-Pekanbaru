import { env } from "cloudflare:workers";
import { requireKetua, accessErrorResponse } from "@/db/access-control";
import { getAttendanceFile } from "@/db/attendance";

export async function GET(request:Request) {
  try {
    await requireKetua();

    const u=new URL(request.url);
    const id=Number(u.searchParams.get("id"));
    const type=u.searchParams.get("type");

    const item:any=await env.DB.prepare(`
      SELECT logo_key, logo_type,
        business_photo_key, business_photo_type,
        profile_photo_key, profile_photo_type
      FROM public_member_submissions
      WHERE id=? LIMIT 1
    `).bind(id).first();

    const media:any={
      logo:[item?.logo_key,item?.logo_type],
      business:[item?.business_photo_key,item?.business_photo_type],
      profile:[item?.profile_photo_key,item?.profile_photo_type],
    };

    const [key,mime]=media[type||""]||[];
    if(!key) return new Response("Foto tidak tersedia",{status:404});

    const file=await getAttendanceFile(key);
    if(!file) return new Response("File tidak ditemukan",{status:404});

    return new Response(file.body,{
      headers:{"content-type":mime||"image/jpeg","cache-control":"private, no-store"}
    });
  } catch(reason) {
    return accessErrorResponse(reason,"Foto belum dapat dibuka.");
  }
}
