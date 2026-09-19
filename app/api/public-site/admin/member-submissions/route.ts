import { requireKetua, accessErrorResponse } from "@/db/access-control";
import { listPublicMemberSubmissions, getPublicMemberSubmission, reviewPublicMemberSubmission } from "@/db/public-member-submissions";

export async function GET(request: Request) {
  try {
    await requireKetua();

    const id = Number(new URL(request.url).searchParams.get("id"));
    if (id) {
      return Response.json({
        submission: await getPublicMemberSubmission(id),
      });
    }

    const result = await listPublicMemberSubmissions();

    return Response.json({
      submissions: result.results || [],
    });
  } catch (reason) {
    return accessErrorResponse(
      reason,
      "Submission member belum dapat dimuat.",
    );
  }
}

export async function PATCH(request:Request) {
  try {
    const user=await requireKetua();
    const b=await request.json();
    await reviewPublicMemberSubmission(Number(b.id),String(b.status),b.business?1:0,b.testimonial?1:0,user.id);
    return Response.json({success:true});
  } catch(reason) {
    return accessErrorResponse(reason,"Review submission belum dapat disimpan.");
  }
}

export async function PUT(request:Request) {
  try {
    await requireKetua();

    const input=await request.json();
    const id=Number(input.id);
    if(!id) {
      return Response.json({error:"ID submission tidak valid."},{status:400});
    }

    const { updatePublicMemberSubmission } =
      await import("@/db/public-member-submissions");

    await updatePublicMemberSubmission(id,input);

    return Response.json({ok:true});
  } catch(reason) {
    return accessErrorResponse(reason,"Perubahan belum dapat disimpan.");
  }
}

export async function DELETE(request:Request) {
  try {
    await requireKetua();
    const {id}=await request.json();
    const item:any=await getPublicMemberSubmission(Number(id));
    if(!item) return Response.json({error:"Submission tidak ditemukan."},{status:404});

    const {deleteAttendanceFile}=await import("@/db/attendance");
    const {deletePublicMemberSubmission}=await import("@/db/public-member-submissions");

    for(const key of [item.logo_key,item.business_photo_key,item.profile_photo_key]) {
      if(key) await deleteAttendanceFile(key);
    }

    await deletePublicMemberSubmission(Number(id));
    return Response.json({ok:true});
  } catch(reason) {
    return accessErrorResponse(reason,"Submission belum dapat dihapus.");
  }
}
