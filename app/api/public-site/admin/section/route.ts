import {
  requireKetua,
  accessErrorResponse,
} from "@/db/access-control";

import { updatePublicSiteSection } from "@/db/public-site";

export async function PUT(request: Request) {
  try {
    const user = await requireKetua();
    const input = await request.json();

    const id = Number(input.id);

    if (!Number.isInteger(id) || id <= 0) {
      return Response.json(
        { error: "ID section tidak valid." },
        { status: 400 },
      );
    }

    await updatePublicSiteSection(
      id,
      {
        eyebrow: String(input.eyebrow ?? ""),
        title: String(input.title ?? ""),
        subtitle: String(input.subtitle ?? ""),
        body: String(input.body ?? ""),
        contentJson: String(input.contentJson ?? "{}"),
        primaryCtaLabel: String(input.primaryCtaLabel ?? ""),
        primaryCtaUrl: String(input.primaryCtaUrl ?? ""),
        secondaryCtaLabel: String(input.secondaryCtaLabel ?? ""),
        secondaryCtaUrl: String(input.secondaryCtaUrl ?? ""),
        sortOrder: Number(input.sortOrder ?? 0),
        isVisible: input.isVisible ? 1 : 0,
      },
      user.id,
    );

    return Response.json({ success: true });
  } catch (reason) {
    return accessErrorResponse(
      reason,
      "Section website belum dapat diperbarui.",
    );
  }
}


function readHeroContent(raw: string) {
  try {
    const value = JSON.parse(raw || "{}");
    return {
      ...value,
      heroImages: Array.isArray(value.heroImages) ? value.heroImages : [],
      heroIntervalMs: Number(value.heroIntervalMs) || 5000,
    };
  } catch {
    return { heroImages: [], heroIntervalMs: 5000 };
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireKetua();
    const form = await request.formData();
    const id = Number(form.get("id"));
    const file = form.get("file");
    const mode = String(form.get("mode") || "");

    if (!id || !(file instanceof File)) {
      return Response.json({ error: "Foto tidak valid." }, { status: 400 });
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return Response.json(
        { error: "Format harus JPG, PNG, atau WebP." },
        { status: 400 },
      );
    }

    const {
      getPublicSiteSectionContent,
      setPublicSiteSectionContent,
      getPublicSiteSectionImage,
      setPublicSiteSectionImage,
    } = await import("@/db/public-site");

    const { saveAttendanceFile, deleteAttendanceFile } =
      await import("@/db/attendance");

    if (mode === "hero") {
      if (file.size > 10 * 1024 * 1024) {
        return Response.json(
          { error: "Maksimal 10 MB per foto Hero." },
          { status: 400 },
        );
      }

      const section = await getPublicSiteSectionContent(id);

      if (!section || section.sectionKey !== "hero") {
        return Response.json(
          { error: "Section Hero tidak valid." },
          { status: 400 },
        );
      }

      const content = readHeroContent(section.contentJson);

      if (content.heroImages.length >= 6) {
        return Response.json(
          { error: "Maksimal 6 foto Hero." },
          { status: 400 },
        );
      }

      const key = await saveAttendanceFile(`public-site/hero/${id}`, file);

      content.heroImages.push({
        key,
        name: file.name.slice(0, 180),
        type: file.type,
      });

      await setPublicSiteSectionContent(
        id,
        JSON.stringify(content),
        user.id,
      );

      return Response.json({ success: true });
    }

    if (mode === "program") {
      const index=Number(form.get("index"));
      const section=await getPublicSiteSectionContent(id);
      if (!section || index<0 || index>3)
        return Response.json({error:"Program tidak valid."},{status:400});
      if (file.size>10*1024*1024)
        return Response.json({error:"Maksimal 10 MB."},{status:400});
      const content=readHeroContent(section.contentJson);
      const programs=Array.isArray(content.programs)?content.programs:[{},{},{},{}];
      const oldKey=programs[index]?.imageKey;
      const key=await saveAttendanceFile(`public-site/programs/${id}/${index}`,file);
      programs[index]={...(programs[index]||{}),imageKey:key,imageName:file.name.slice(0,180),imageType:file.type};
      content.programs=programs;
      await setPublicSiteSectionContent(id,JSON.stringify(content),user.id);
      if(oldKey) await deleteAttendanceFile(oldKey).catch(()=>undefined);
      return Response.json({success:true});
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: "Maksimal 10 MB." }, { status: 400 });
    }

    const previous = await getPublicSiteSectionImage(id);
    const key = await saveAttendanceFile(`public-site/sections/${id}`, file);

    await setPublicSiteSectionImage(
      id,
      key,
      file.name.slice(0, 180),
      file.type,
      user.id,
    );

    if (previous?.imageKey) {
      await deleteAttendanceFile(previous.imageKey).catch(() => undefined);
    }

    return Response.json({ success: true });
  } catch (reason) {
    return accessErrorResponse(
      reason,
      "Foto section belum dapat diunggah.",
    );
  }
}


export async function GET(request: Request) {
  try {
    await requireKetua();

    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    const mode = url.searchParams.get("mode");

    if (!id) {
      return new Response("Foto tidak valid", { status: 400 });
    }

    const {
      getPublicSiteSectionContent,
      getPublicSiteSectionImage,
    } = await import("@/db/public-site");

    const { getAttendanceFile } = await import("@/db/attendance");

    if (mode === "hero") {
      const section = await getPublicSiteSectionContent(id);

      if (!section) {
        return new Response("Hero tidak ditemukan", { status: 404 });
      }

      const content = readHeroContent(section.contentJson);
      const indexRaw = url.searchParams.get("index");

      if (indexRaw === null) {
        return Response.json({
          images: content.heroImages.map((item: any) => ({
            name: item.name,
            type: item.type,
          })),
          intervalMs: content.heroIntervalMs,
        });
      }

      const image = content.heroImages[Number(indexRaw)];

      if (!image?.key) {
        return new Response("Foto tidak ditemukan", { status: 404 });
      }

      const object = await getAttendanceFile(image.key);

      if (!object) {
        return new Response("File tidak ditemukan", { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          "content-type": image.type || "application/octet-stream",
          "cache-control": "private, no-store",
        },
      });
    }

    if (mode === "program") {
      const section=await getPublicSiteSectionContent(id);
      const index=Number(url.searchParams.get("index"));
      if(!section) return new Response("Program tidak ditemukan",{status:404});
      const content=readHeroContent(section.contentJson);
      const card=Array.isArray(content.programs)?content.programs[index]:null;
      if(!card?.imageKey) return new Response("Foto belum tersedia",{status:404});
      const object=await getAttendanceFile(card.imageKey);
      if(!object) return new Response("Foto tidak ditemukan",{status:404});
      return new Response(object.body,{headers:{
        "content-type":card.imageType||"application/octet-stream",
        "cache-control":"private, no-store",
      }});
    }

    const image = await getPublicSiteSectionImage(id);

    if (!image?.imageKey) {
      return new Response("Foto belum tersedia", { status: 404 });
    }

    const object = await getAttendanceFile(image.imageKey);

    if (!object) {
      return new Response("Foto tidak ditemukan", { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "content-type":
          image.imageType ||
          object.httpMetadata?.contentType ||
          "application/octet-stream",
        "cache-control": "private, no-store",
      },
    });
  } catch (reason) {
    return accessErrorResponse(
      reason,
      "Foto section belum dapat dibuka.",
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireKetua();
    const body = await request.json();
    const { getPublicSiteSectionContent, setPublicSiteSectionContent } =
      await import("@/db/public-site");
    const section = await getPublicSiteSectionContent(Number(body.id));
    if (!section || section.sectionKey !== "hero")
      return Response.json({ error: "Hero tidak valid." }, { status: 400 });
    const content = readHeroContent(section.contentJson);
    if ([3000, 5000, 7000, 10000].includes(Number(body.intervalMs)))
      content.heroIntervalMs = Number(body.intervalMs);
    if (Number.isInteger(body.fromIndex) && Number.isInteger(body.toIndex)) {
      const [item] = content.heroImages.splice(body.fromIndex, 1);
      if (item) content.heroImages.splice(body.toIndex, 0, item);
    }
    await setPublicSiteSectionContent(Number(body.id), JSON.stringify(content), user.id);
    return Response.json({ success: true });
  } catch (reason) { return accessErrorResponse(reason, "Pengaturan Hero gagal."); }
}
export async function DELETE(request: Request) {
  try {
    const user = await requireKetua();
    const body = await request.json();
    const { getPublicSiteSectionContent, setPublicSiteSectionContent } =
      await import("@/db/public-site");
    const { deleteAttendanceFile } = await import("@/db/attendance");
    const section = await getPublicSiteSectionContent(Number(body.id));
    if (!section) return Response.json({ error: "Hero tidak ditemukan." }, { status: 404 });
    const content = readHeroContent(section.contentJson);
    const [removed] = content.heroImages.splice(Number(body.index), 1);
    if (removed?.key) await deleteAttendanceFile(removed.key).catch(() => undefined);
    await setPublicSiteSectionContent(Number(body.id), JSON.stringify(content), user.id);
    return Response.json({ success: true });
  } catch (reason) { return accessErrorResponse(reason, "Foto Hero gagal dihapus."); }
}
