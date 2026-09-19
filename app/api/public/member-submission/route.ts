import { createPublicMemberSubmission } from "@/db/public-member-submissions";
import { saveAttendanceFile } from "@/db/attendance";

const types=new Set(["image/jpeg","image/png","image/webp"]);

async function upload(file:FormDataEntryValue|null,prefix:string) {
  if(!(file instanceof File) || !file.size) return [null,null,null];
  if(!types.has(file.type)) throw new Error("Foto harus JPG, PNG, atau WebP.");
  if(file.size>10*1024*1024) throw new Error("Maksimal 10 MB per foto.");
  const key=await saveAttendanceFile(prefix,file);
  return [key,file.name.slice(0,180),file.type];
}

export async function POST(request:Request) {
  try {
    const f=await request.formData();

    const memberName=String(f.get("memberName")||"").trim();
    const whatsapp=String(f.get("whatsapp")||"").trim();
    const businessName=String(f.get("businessName")||"").trim();

    if(!memberName || !whatsapp || !businessName)
      return Response.json({error:"Nama, WhatsApp, dan nama usaha wajib diisi."},{status:400});

    if(String(f.get("consent"))!=="true")
      return Response.json({error:"Persetujuan publikasi wajib dicentang."},{status:400});

    const logo=await upload(f.get("logo"),"public-member/logo");
    const business=await upload(f.get("businessPhoto"),"public-member/business");
    const profile=await upload(f.get("profilePhoto"),"public-member/profile");

    const id=await createPublicMemberSubmission([
      memberName,String(f.get("tdaPassport")||""),whatsapp,
      businessName,String(f.get("businessCategory")||""),
      String(f.get("businessDescription")||""),String(f.get("businessLocation")||""),
      String(f.get("instagramUrl")||""),String(f.get("websiteUrl")||""),
      String(f.get("marketplaceUrl")||""),
      ...logo,...business,
      String(f.get("positionTitle")||""),String(f.get("testimonial")||""),
      ...profile,
    ]);

    return Response.json({success:true,id});
  } catch(reason) {
    return Response.json(
      {error:reason instanceof Error ? reason.message : "Data belum dapat dikirim."},
      {status:400},
    );
  }
}
