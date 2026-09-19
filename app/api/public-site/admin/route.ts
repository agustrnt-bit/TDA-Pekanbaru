import {
  requireKetua,
  accessErrorResponse,
} from "@/db/access-control";

import {
  getPublicSiteSettings,
  updatePublicSiteSettings,
  listPublicSiteSections,
  listPublicNavigation,
  setPublicSiteSectionStatus,
} from "@/db/public-site";

export async function GET() {
  try {
    await requireKetua();

    const [settings, sections, navigation] = await Promise.all([
      getPublicSiteSettings(),
      listPublicSiteSections(),
      listPublicNavigation(),
    ]);

    return Response.json({
      settings,
      sections,
      navigation,
    });
  } catch (reason) {
    return accessErrorResponse(
      reason,
      "Data website publik belum dapat dimuat.",
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireKetua();
    const input = await request.json();

    await updatePublicSiteSettings(
      {
        siteName: String(input.siteName ?? ""),
        siteTagline: String(input.siteTagline ?? ""),
        siteDescription: String(input.siteDescription ?? ""),
        contactWhatsapp: String(input.contactWhatsapp ?? ""),
        contactEmail: String(input.contactEmail ?? ""),
        address: String(input.address ?? ""),
        instagramUrl: String(input.instagramUrl ?? ""),
        youtubeUrl: String(input.youtubeUrl ?? ""),
        linkedinUrl: String(input.linkedinUrl ?? ""),
        tiktokUrl: String(input.tiktokUrl ?? ""),
        footerText: String(input.footerText ?? ""),
        seoTitle: String(input.seoTitle ?? ""),
        seoDescription: String(input.seoDescription ?? ""),
      },
      user.id,
    );

    return Response.json({ success: true });
  } catch (reason) {
    return accessErrorResponse(
      reason,
      "Pengaturan website belum dapat disimpan.",
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireKetua();
    const input = await request.json();

    const id = Number(input.id);
    const status = String(input.status);

    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "ID section tidak valid." }, { status: 400 });
    }

    if (!["draft", "published", "archived"].includes(status)) {
      return Response.json({ error: "Status tidak valid." }, { status: 400 });
    }

    await setPublicSiteSectionStatus(
      id,
      status as "draft" | "published" | "archived",
      user.id,
    );

    return Response.json({ success: true });
  } catch (reason) {
    return accessErrorResponse(
      reason,
      "Status section belum dapat diperbarui.",
    );
  }
}
