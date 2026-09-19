"use client";

import { useEffect, useState } from "react";
import { HighlightMarquee } from "@/components/public-site/highlight-marquee";

type Tab = "settings" | "homepage" | "submissions" | "navigation" | "preview";

type CmsSection = {
  id: number;
  sectionKey: string;
  sectionType: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  contentJson: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  status: "draft" | "published" | "archived";
  isVisible: number;
  sortOrder: number;
};

type CmsData = {
  settings: {
    siteName: string;
    siteTagline: string;
    siteDescription: string;
    contactWhatsapp: string;
    contactEmail: string;
    address: string;
    instagramUrl: string;
    youtubeUrl: string;
    linkedinUrl: string;
    tiktokUrl: string;
    footerText: string;
    seoTitle: string;
    seoDescription: string;
  } | null;
  sections: CmsSection[];
  navigation: unknown[];
};

const defaultPrograms = [
  { title:"Kelas Reguler", description:"Pembelajaran bisnis terstruktur dari fondasi hingga leadership.", ctaLabel:"Lihat Program", ctaUrl:"#", isVisible:true },
  { title:"KMB – Kelompok Mentoring Bisnis", description:"Pendampingan dan diskusi intens untuk membantu member bertumbuh.", ctaLabel:"Lihat Program", ctaUrl:"#", isVisible:true },
  { title:"Continuous Learning", description:"Workshop, seminar, dan pembelajaran lanjutan sesuai kebutuhan pengusaha.", ctaLabel:"Lihat Program", ctaUrl:"#", isVisible:true },
  { title:"Networking & Kolaborasi Bisnis", description:"Memperluas relasi, kolaborasi, dan peluang bisnis antar-member.", ctaLabel:"Lihat Program", ctaUrl:"#", isVisible:true },
];

const impactFields = [
  ["impact1Value","impact1Label","500+","Member & Alumni"],
  ["impact2Value","impact2Label","50+","Program Edukasi"],
  ["impact3Value","impact3Label","100+","Kolaborasi Bisnis"],
  ["impact4Value","impact4Label","Berdampak","untuk Masyarakat"],
] as const;

function parseContent(raw:string): Record<string,string> {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export default function PublicSiteManagement() {
  const [tab, setTab] = useState<Tab>("settings");
  const [data, setData] = useState<CmsData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingSection, setEditingSection] = useState<CmsSection | null>(null);
  const [submissions,setSubmissions]=useState<any[]>([]);
  const [publishedBusinesses,setPublishedBusinesses]=useState<any[]>([]);
  const [publishedTestimonials,setPublishedTestimonials]=useState<any[]>([]);
  const [selectedSubmission,setSelectedSubmission]=useState<any|null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);
  const [heroImages, setHeroImages] = useState<Array<{name:string;type:string}>>([]);
  const [heroIntervalMs, setHeroIntervalMs] = useState(5000);
  const [heroSlide, setHeroSlide] = useState(0);
  const [uploadingHero, setUploadingHero] = useState(false);

  const [form, setForm] = useState({
    siteName: "",
    siteTagline: "",
    siteDescription: "",
    contactWhatsapp: "",
    contactEmail: "",
    address: "",
    instagramUrl: "",
    youtubeUrl: "",
    linkedinUrl: "",
    tiktokUrl: "",
    footerText: "",
    seoTitle: "",
    seoDescription: "",
  });

  useEffect(() => {
    fetch("/api/public-site/admin")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Gagal memuat CMS");
        setData(payload);

        if (payload.settings) {
          setForm({
            siteName: payload.settings.siteName ?? "",
            siteTagline: payload.settings.siteTagline ?? "",
            siteDescription: payload.settings.siteDescription ?? "",
            contactWhatsapp: payload.settings.contactWhatsapp ?? "",
            contactEmail: payload.settings.contactEmail ?? "",
            address: payload.settings.address ?? "",
            instagramUrl: payload.settings.instagramUrl ?? "",
            youtubeUrl: payload.settings.youtubeUrl ?? "",
            linkedinUrl: payload.settings.linkedinUrl ?? "",
            tiktokUrl: payload.settings.tiktokUrl ?? "",
            footerText: payload.settings.footerText ?? "",
            seoTitle: payload.settings.seoTitle ?? "",
            seoDescription: payload.settings.seoDescription ?? "",
          });
        }
      })
      .catch((reason) => setError(reason.message));
  }, []);

  useEffect(()=>{if(data)void refreshHeroMedia();},[data]);
  useEffect(()=>{if(heroImages.length<2)return;const t=window.setInterval(
    ()=>setHeroSlide(v=>(v+1)%heroImages.length),heroIntervalMs);
    return()=>window.clearInterval(t);},[heroImages.length,heroIntervalMs]);

  useEffect(()=>{
    if(tab!=="submissions") return;
    fetch("/api/public-site/admin/member-submissions")
      .then(r=>r.json())
      .then(p=>setSubmissions(p.submissions||[]))
      .catch(()=>setSubmissions([]));
  },[tab]);

  async function openSubmission(id:number) {
    const r=await fetch(`/api/public-site/admin/member-submissions?id=${id}`);
    const p=await r.json(); setSelectedSubmission(p.submission||null);
  }
  async function deleteSubmission(id:number) {
    const ok=window.confirm(
      "Hapus submission ini secara permanen? Jika sudah dipublikasikan, kontennya juga akan hilang dari website."
    );
    if(!ok)return;

    const res=await fetch("/api/public-site/admin/member-submissions",{
      method:"DELETE",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({id}),
    });
    if(!res.ok)return alert("Submission belum berhasil dihapus.");

    setSubmissions(current=>current.filter((x:any)=>x.id!==id));
    if(selectedSubmission?.id===id)setSelectedSubmission(null);
    alert("Submission berhasil dihapus.");
  }

  async function saveSubmissionChanges() {
    if (!selectedSubmission) return;
    const res=await fetch("/api/public-site/admin/member-submissions",{
      method:"PUT",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(selectedSubmission),
    });
    if(!res.ok) return alert("Perubahan belum dapat disimpan.");
    alert("Perubahan berhasil disimpan.");
  }

  async function reviewSubmission(status:string,business:boolean,testimonial:boolean) {
    if(!selectedSubmission)return;

    let pesan="Yakin ingin melanjutkan?";
    if(status==="rejected") pesan="Yakin ingin menolak submission ini?";
    else if(business && testimonial) pesan="Data ini akan dipublikasikan ke Direktori Pengusaha dan Testimoni. Lanjutkan?";
    else if(business) pesan="Data ini akan dipublikasikan ke Direktori Pengusaha. Lanjutkan?";
    else if(testimonial) pesan="Testimoni ini akan dipublikasikan di website. Lanjutkan?";

    if(!window.confirm(pesan)) return;

    const save=await fetch("/api/public-site/admin/member-submissions",{
      method:"PUT",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(selectedSubmission),
    });
    if(!save.ok)return alert("Perubahan belum dapat disimpan.");

    const review=await fetch("/api/public-site/admin/member-submissions",{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({id:selectedSubmission.id,status,business,testimonial}),
    });
    if(!review.ok)return alert("Status publikasi belum dapat diperbarui.");

    let sukses="Perubahan berhasil diproses.";
    if(status==="rejected") sukses="Submission berhasil ditolak.";
    else if(business && testimonial) sukses="Berhasil dipublikasikan ke Direktori Pengusaha dan Testimoni.";
    else if(business) sukses="Berhasil dipublikasikan ke Direktori Pengusaha.";
    else if(testimonial) sukses="Testimoni berhasil dipublikasikan.";

    alert(sukses);

    setSelectedSubmission(null);
    setTab("homepage");
    setTab("submissions");
  }

  useEffect(()=>{
    Promise.all([
      fetch("/api/public/member-content?type=businesses").then(r=>r.json()),
      fetch("/api/public/member-content?type=testimonials").then(r=>r.json()),
    ]).then(([businesses,testimonials])=>{
      setPublishedBusinesses(businesses.items||[]);
      setPublishedTestimonials(testimonials.items||[]);
    });
  },[]);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/public-site/admin", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Gagal menyimpan pengaturan");
      }

      setMessage("Pengaturan website berhasil disimpan.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Pengaturan belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateEditingSection(
    field: keyof CmsSection,
    value: string | number,
  ) {
    setEditingSection((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  async function saveSection() {
    if (!editingSection) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/public-site/admin/section", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingSection),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Section belum dapat disimpan.");
      }

      setData((current) =>
        current
          ? {
              ...current,
              sections: current.sections.map((section) =>
                section.id === editingSection.id ? editingSection : section,
              ),
            }
          : current,
      );

      setMessage("Section berhasil disimpan.");
      setEditingSection(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Section belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadSectionImage(file: File) {
    if (!editingSection) return;

    setUploadingImage(true);
    setError("");

    try {
      const body = new FormData();
      body.append("id", String(editingSection.id));
      body.append("file", file);

      const response = await fetch("/api/public-site/admin/section", {
        method: "POST",
        body,
      });

      const raw = await response.text();
      let payload: { error?: string } = {};

      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw || "Gagal mengunggah foto" };
      }

      if (!response.ok) {
        throw new Error(payload.error || "Gagal mengunggah foto");
      }

      setImageVersion((value) => value + 1);
      setMessage("Foto section berhasil diunggah.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload foto gagal.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function refreshHeroMedia() {
    const hero=data?.sections.find(s=>s.sectionKey==="hero"); if(!hero)return;
    const r=await fetch(`/api/public-site/admin/section?id=${hero.id}&mode=hero`);
    if(!r.ok)return; const p=await r.json();
    setHeroImages(p.images||[]); setHeroIntervalMs(p.intervalMs||5000); setHeroSlide(0);
  }
  async function uploadHeroImages(files: File[]) {
    if(!editingSection)return;
    if(heroImages.length+files.length>6){setError("Maksimal 6 foto Hero.");return;}
    if(files.some(f=>f.size>10*1024*1024)){setError("Maksimal 10 MB per foto.");return;}
    setUploadingHero(true);
    try { for(const file of files){const f=new FormData();f.append("id",String(editingSection.id));f.append("mode","hero");f.append("file",file);
      const r=await fetch("/api/public-site/admin/section",{method:"POST",body:f});if(!r.ok)throw new Error(await r.text());}
      setImageVersion(v=>v+1);await refreshHeroMedia();
    } catch(e){setError(e instanceof Error?e.message:"Upload gagal.");} finally{setUploadingHero(false);}
  }

  async function heroAction(body: object) {
    if(!editingSection)return;
    await fetch("/api/public-site/admin/section",{method:"PATCH",headers:{"content-type":"application/json"},
      body:JSON.stringify({id:editingSection.id,...body})}); await refreshHeroMedia();
  }
  async function removeHeroImage(index:number) {
    if(!editingSection)return;
    await fetch("/api/public-site/admin/section",{method:"DELETE",headers:{"content-type":"application/json"},
      body:JSON.stringify({id:editingSection.id,index})}); setImageVersion(v=>v+1);await refreshHeroMedia();
  }

  function updateEditingContent(field:string,value:string) {
    setEditingSection(current => {
      if (!current) return current;
      const content=parseContent(current.contentJson);
      return {...current,contentJson:JSON.stringify({...content,[field]:value})};
    });
  }

  function updateProgramCard(index:number, field:string, value:any) {
    setEditingSection(current => {
      if (!current) return current;
      const content=parseContent(current.contentJson);
      const programs=Array.isArray(content.programs)
        ? [...content.programs]
        : defaultPrograms.map(item=>({...item}));
      programs[index]={...programs[index], [field]:value};
      return {...current,contentJson:JSON.stringify({...content,programs})};
    });
  }

  async function uploadProgramImage(index:number,file:File) {
    if(!editingSection)return;
    if(file.size>10*1024*1024){setError("Maksimal 10 MB.");return;}

    const f=new FormData();
    f.append("id",String(editingSection.id));
    f.append("mode","program");
    f.append("index",String(index));
    f.append("file",file);

    const r=await fetch("/api/public-site/admin/section",{method:"POST",body:f});
    const raw=await r.text();
    if(!r.ok){setError(raw);return;}

    const refresh=await fetch("/api/public-site/admin");
    const payload=await refresh.json();

    if(refresh.ok){
      setData(payload);
      const fresh=payload.sections?.find((x:any)=>x.id===editingSection.id);
      if(fresh)setEditingSection(fresh);
    }

    setImageVersion(v=>v+1);
    setMessage("Foto Program berhasil disimpan.");
  }

  async function changeSectionStatus(
    id: number,
    status: "draft" | "published",
  ) {
    setError("");

    const response = await fetch("/api/public-site/admin", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "Status belum dapat diperbarui.");
      return;
    }

    setData((current) =>
      current
        ? {
            ...current,
            sections: current.sections.map((section) =>
              section.id === id ? { ...section, status } : section,
            ),
          }
        : current,
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "settings", label: "Pengaturan" },
    { id: "homepage", label: "Homepage" },
    { id: "submissions", label: "Submission Member" },
    { id: "navigation", label: "Navigasi" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
          Website Publik
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          Kelola Website TDA Pekanbaru
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atur konten, navigasi, publikasi, dan preview website.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === item.id
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !data ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">
          Memuat data website...
        </div>
      ) : tab === "settings" ? (
        <div className="rounded-2xl border bg-white p-6">
          <div>
            <h2 className="text-lg font-bold">Pengaturan Umum</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Informasi utama website TDA Pekanbaru.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold">Nama Website</span>
              <input
                value={form.siteName}
                onChange={(e) => updateForm("siteName", e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold">Tagline</span>
              <input
                value={form.siteTagline}
                onChange={(e) => updateForm("siteTagline", e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-5 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Deskripsi Website</span>
              <textarea
                value={form.siteDescription}
                onChange={(e) => updateForm("siteDescription", e.target.value)}
                rows={4}
                className="w-full rounded-xl border px-4 py-3 text-sm"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold">WhatsApp</span>
                <input
                  value={form.contactWhatsapp}
                  onChange={(e) => updateForm("contactWhatsapp", e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold">Email</span>
                <input
                  value={form.contactEmail}
                  onChange={(e) => updateForm("contactEmail", e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">Alamat</span>
              <textarea
                value={form.address}
                onChange={(e) => updateForm("address", e.target.value)}
                rows={3}
                className="w-full rounded-xl border px-4 py-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-6 border-t pt-6">
            <h3 className="font-bold">Media Sosial</h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ["instagramUrl", "Instagram"],
                ["youtubeUrl", "YouTube"],
                ["linkedinUrl", "LinkedIn"],
                ["tiktokUrl", "TikTok"],
              ].map(([field, label]) => (
                <label key={field} className="space-y-2">
                  <span className="text-sm font-semibold">{label}</span>
                  <input
                    value={form[field as keyof typeof form]}
                    onChange={(e) =>
                      updateForm(field as keyof typeof form, e.target.value)
                    }
                    className="w-full rounded-xl border px-4 py-3 text-sm"
                    placeholder="https://..."
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t pt-6">
            <h3 className="font-bold">Footer & SEO</h3>

            <div className="mt-4 space-y-4">
              <input
                value={form.footerText}
                onChange={(e) => updateForm("footerText", e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm"
                placeholder="Teks footer"
              />

              <input
                value={form.seoTitle}
                onChange={(e) => updateForm("seoTitle", e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm"
                placeholder="SEO Title"
              />

              <textarea
                value={form.seoDescription}
                onChange={(e) => updateForm("seoDescription", e.target.value)}
                rows={3}
                className="w-full rounded-xl border px-4 py-3 text-sm"
                placeholder="SEO Description"
              />
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
          </div>
        </div>
      ) : tab === "homepage" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Susunan Homepage</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.sections.length} section website tersimpan.
            </p>
          </div>

          {editingSection && (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Edit Section
                  </p>
                  <h3 className="mt-1 text-lg font-bold">
                    {editingSection.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="rounded-lg border px-3 py-2 text-xs font-bold"
                >
                  Tutup
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                <input
                  value={editingSection.eyebrow}
                  onChange={(e) =>
                    updateEditingSection("eyebrow", e.target.value)
                  }
                  className="rounded-xl border px-4 py-3 text-sm"
                  placeholder="Eyebrow / label kecil"
                />

                <input
                  value={editingSection.title}
                  onChange={(e) =>
                    updateEditingSection("title", e.target.value)
                  }
                  className="rounded-xl border px-4 py-3 text-sm"
                  placeholder="Judul"
                />

                <input
                  value={editingSection.subtitle}
                  onChange={(e) =>
                    updateEditingSection("subtitle", e.target.value)
                  }
                  className="rounded-xl border px-4 py-3 text-sm"
                  placeholder="Subjudul"
                />

                <textarea
                  value={editingSection.body}
                  onChange={(e) =>
                    updateEditingSection("body", e.target.value)
                  }
                  rows={5}
                  className="rounded-xl border px-4 py-3 text-sm"
                  placeholder="Isi / deskripsi section"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    value={editingSection.primaryCtaLabel}
                    onChange={(e) =>
                      updateEditingSection("primaryCtaLabel", e.target.value)
                    }
                    className="rounded-xl border px-4 py-3 text-sm"
                    placeholder="CTA Utama"
                  />

                  <input
                    value={editingSection.primaryCtaUrl}
                    onChange={(e) =>
                      updateEditingSection("primaryCtaUrl", e.target.value)
                    }
                    className="rounded-xl border px-4 py-3 text-sm"
                    placeholder="Link CTA Utama"
                  />

                  <input
                    value={editingSection.secondaryCtaLabel}
                    onChange={(e) =>
                      updateEditingSection("secondaryCtaLabel", e.target.value)
                    }
                    className="rounded-xl border px-4 py-3 text-sm"
                    placeholder="CTA Kedua"
                  />

                  <input
                    value={editingSection.secondaryCtaUrl}
                    onChange={(e) =>
                      updateEditingSection("secondaryCtaUrl", e.target.value)
                    }
                    className="rounded-xl border px-4 py-3 text-sm"
                    placeholder="Link CTA Kedua"
                  />
                </div>

                
                <div className="rounded-xl border bg-slate-50 p-4">
                  <label className="text-sm font-semibold">
                    {editingSection.sectionKey==="hero" ? "Slider Foto Hero" : "Foto / Media Section"}
                  </label>

                  <img
                    src={`/api/public-site/admin/section?id=${editingSection.id}&v=${imageVersion}`}
                    alt="Preview foto section"
                    className="mt-3 h-44 w-full rounded-xl border bg-white object-cover"
                    onError={(e) => e.currentTarget.classList.add("hidden")}
                    onLoad={(e) => e.currentTarget.classList.remove("hidden")}
                  />

                  <input
                    key={imageVersion}
                    type="file"
                    multiple={editingSection.sectionKey==="hero"}
                    accept=".jpg,.jpeg,.png,.webp"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      const files=Array.from(e.target.files||[]);
                      if(editingSection.sectionKey==="hero") void uploadHeroImages(files);
                      else if(files[0]) void uploadSectionImage(files[0]);
                    }}
                    className="mt-3 w-full rounded-xl border bg-white p-3 text-sm"
                  />

                  <p className="mt-2 text-xs text-muted-foreground">
                    {editingSection.sectionKey==="hero" ? `${heroImages.length}/6 foto · maks. 10 MB/foto` : "JPG, PNG, atau WebP. Maksimal 10 MB."}
                  </p>
                  {editingSection.sectionKey==="hero" ? <div className="mt-3 space-y-2">
                    <select value={heroIntervalMs} onChange={e=>void heroAction({intervalMs:Number(e.target.value)})} className="rounded-lg border bg-white px-3 py-2 text-sm">
                      <option value={3000}>3 detik</option><option value={5000}>5 detik</option>
                      <option value={7000}>7 detik</option><option value={10000}>10 detik</option>
                    </select>
                    {heroImages.map((img,i)=><div key={i} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate">{i+1}. {img.name}</span>
                      <button type="button" onClick={()=>void heroAction({fromIndex:i,toIndex:i-1})}>←</button>
                      <button type="button" onClick={()=>void heroAction({fromIndex:i,toIndex:i+1})}>→</button>
                      <button type="button" className="text-red-600" onClick={()=>void removeHeroImage(i)}>Hapus</button>
                    </div>)}
                  </div> : null}
                </div>

                {editingSection.sectionKey==="impact" ? (
                  <div className="rounded-2xl border bg-emerald-50 p-5">
                    <p className="mb-4 font-bold">Statistik Dampak</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      {impactFields.map(([vk,lk,dv,dl],i)=>{const c=parseContent(editingSection.contentJson);return <div key={vk} className="rounded-xl border bg-white p-4"><p className="mb-2 text-xs font-bold">Statistik {i+1}</p><input value={c[vk]||dv} onChange={e=>updateEditingContent(vk,e.target.value)} className="mb-2 w-full rounded-lg border px-3 py-2"/><input value={c[lk]||dl} onChange={e=>updateEditingContent(lk,e.target.value)} className="w-full rounded-lg border px-3 py-2"/></div>})}
                    </div>
                  </div>
                ) : null}

                {editingSection.sectionKey==="programs" ? (
                  <div className="space-y-4 rounded-2xl border bg-slate-50 p-5">
                    <p className="font-bold">4 Program Unggulan</p>
                    {(parseContent(editingSection.contentJson).programs || defaultPrograms).map((item:any,i:number)=>(
                      <div key={i} className="rounded-xl border bg-white p-4">
                        <img
                          src={`/api/public-site/admin/section?id=${editingSection.id}&mode=program&index=${i}&v=${imageVersion}`}
                          className="mb-3 h-40 w-full rounded-xl object-cover"
                          onError={e=>e.currentTarget.classList.add("hidden")}
                          onLoad={e=>e.currentTarget.classList.remove("hidden")}
                          alt={item.title}
                        />
                        <input type="file" accept=".jpg,.jpeg,.png,.webp"
                          onChange={e=>{const f=e.target.files?.[0];if(f)void uploadProgramImage(i,f)}}
                          className="mb-3 w-full rounded-lg border p-2 text-sm"/>
                        <input value={item.title} onChange={e=>updateProgramCard(i,"title",e.target.value)} className="w-full rounded-lg border px-3 py-2 font-semibold"/>
                        <textarea value={item.description} onChange={e=>updateProgramCard(i,"description",e.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2" />
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <input value={item.ctaLabel} onChange={e=>updateProgramCard(i,"ctaLabel",e.target.value)} className="rounded-lg border px-3 py-2" />
                          <input value={item.ctaUrl} onChange={e=>updateProgramCard(i,"ctaUrl",e.target.value)} className="rounded-lg border px-3 py-2" />
                        </div>
                        <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={item.isVisible!==false} onChange={e=>updateProgramCard(i,"isVisible",e.target.checked)}/> Tampilkan kartu</label>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-5">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    Urutan
                    <input
                      type="number"
                      value={editingSection.sortOrder}
                      onChange={(e) =>
                        updateEditingSection("sortOrder", Number(e.target.value))
                      }
                      className="w-24 rounded-lg border px-3 py-2"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(editingSection.isVisible)}
                      onChange={(e) =>
                        updateEditingSection(
                          "isVisible",
                          e.target.checked ? 1 : 0,
                        )
                      }
                    />
                    Tampilkan di website
                  </label>
                </div>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    className="rounded-xl border px-4 py-2.5 text-sm font-bold"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={saveSection}
                    disabled={saving}
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Menyimpan..." : "Simpan Section"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.sections.map((section) => (
              <div
                key={section.id}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {section.sectionType}
                    </p>
                    <h3 className="mt-1 font-bold">{section.title}</h3>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      section.status === "published"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {section.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <span className="text-xs text-muted-foreground">
                    Urutan {section.sortOrder}
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingSection(section)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-muted"
                    >
                      Edit
                    </button>

                    <button
                    type="button"
                    onClick={() =>
                      changeSectionStatus(
                        section.id,
                        section.status === "published" ? "draft" : "published",
                      )
                    }
                    className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-muted"
                  >
                    {section.status === "published"
                      ? "Jadikan Draft"
                      : "Publish"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === "submissions" ? (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">Submission Member</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Data Profil Usaha & Testimoni yang menunggu review admin.
          </p>

          <div className="mt-6 space-y-3">
            {submissions.length ? submissions.map((item:any)=>(
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
                <div>
                  <p className="font-bold">{item.memberName}</p>
                  <p className="text-sm text-muted-foreground">{item.businessName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={()=>void openSubmission(item.id)}
                    className="rounded-xl border px-4 py-2 text-sm font-bold">
                    Review
                  </button>

                  <button type="button" onClick={()=>void deleteSubmission(item.id)}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100">
                    Hapus
                  </button>
                </div>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                  {item.reviewStatus === "pending" ? "Menunggu Review" : item.reviewStatus}
                </span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Belum ada submission member.</p>
            )}
          </div>
          {selectedSubmission ? <div className="mt-6 rounded-2xl border bg-slate-50 p-5">
            <h3 className="text-lg font-bold">{selectedSubmission.memberName}</h3>
            <p className="mt-1 font-semibold">{selectedSubmission.businessName}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["memberName","Nama Member"],
                ["tdaPassport","TDA Passport"],
                ["whatsapp","WhatsApp"],
                ["businessName","Nama Usaha"],
                ["businessCategory","Bidang Usaha"],
                ["businessLocation","Lokasi Usaha"],
                ["instagramUrl","Instagram"],
                ["websiteUrl","Website"],
                ["marketplaceUrl","Marketplace"],
                ["positionTitle","Jabatan / Posisi"],
              ].map(([field,label])=>(
                <label key={field} className="text-sm font-medium">
                  {label}
                  <input
                    value={selectedSubmission[field]||""}
                    onChange={e=>setSelectedSubmission({...selectedSubmission,[field]:e.target.value})}
                    className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"
                  />
                </label>
              ))}
            </div>

            <label className="mt-4 block text-sm font-medium">
              Deskripsi Usaha
              <textarea
                value={selectedSubmission.businessDescription||""}
                onChange={e=>setSelectedSubmission({...selectedSubmission,businessDescription:e.target.value})}
                className="mt-1 min-h-28 w-full rounded-xl border px-3 py-2 font-normal"
              />
            </label>

            <label className="mt-4 block text-sm font-medium">
              Testimoni
              <textarea
                value={selectedSubmission.testimonial||""}
                onChange={e=>setSelectedSubmission({...selectedSubmission,testimonial:e.target.value})}
                className="mt-1 min-h-32 w-full rounded-xl border px-3 py-2 font-normal"
              />
            </label>

            <button
              type="button"
              onClick={saveSubmissionChanges}
              className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Simpan Perubahan
            </button>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[
                ["logo","Logo Usaha"],
                ["business","Foto Produk / Tempat Usaha"],
                ["profile","Foto Member untuk Testimoni"],
              ].map(([type,label])=>(
                <div key={type} className="rounded-xl border bg-white p-3">
                  <p className="mb-2 text-xs font-bold">{label}</p>
                  <img
                    src={`/api/public-site/admin/member-submissions/image?id=${selectedSubmission.id}&type=${type}`}
                    className="h-40 w-full rounded-lg object-cover"
                    onError={e=>e.currentTarget.classList.add("hidden")}
                    alt={label}
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={()=>void reviewSubmission("published",true,false)} className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white">Publish Direktori</button>
              <button onClick={()=>void reviewSubmission("published",false,true)} className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white">Publish Testimoni</button>
              <button onClick={()=>void reviewSubmission("published",true,true)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">Publish Keduanya</button>
              <button onClick={()=>void reviewSubmission("rejected",false,false)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600">Tolak</button>
            </div>
          </div> : null}
        </div>
      ) : tab === "navigation" ? (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">Navigasi</h2>
            <div className="mt-5 rounded-xl border bg-slate-50 p-4">
              <label className="text-sm font-semibold">Foto / Media Section</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                disabled={uploadingImage}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadSectionImage(file);
                }}
                className="mt-2 w-full rounded-xl border bg-white p-3 text-sm"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                JPG, PNG, atau WebP. Maksimal 10 MB.
              </p>
            </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {data.navigation.length} menu tersimpan.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">Preview Homepage</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.sections.length} section dari CMS staging.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
            {[...data.sections]
              .filter((section) => section.isVisible === 1 && section.status !== "archived")
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((section) => (
                <section
                  key={section.id}
                  className={
                    section.sectionKey === "hero"
                      ? "relative isolate flex min-h-[680px] flex-col items-start justify-start overflow-hidden bg-slate-950 px-[6%] pb-20 pt-[7%] text-left text-white md:pr-[48%]"
                      : section.sectionKey === "about"
                        ? "relative border-b bg-white px-8 py-16 md:min-h-[520px] md:px-[6%] md:py-20 md:pr-[50%]"
                        : section.sectionKey === "impact"
                        ? "relative border-b bg-emerald-50 px-8 py-20 md:min-h-[720px] md:px-[6%] md:py-24 md:pr-[52%]"
                        : section.sectionKey === "programs"
                          ? "border-b bg-slate-950 px-8 py-20 text-white md:px-[6%] md:py-24"
                          : "border-b px-8 py-14 last:border-b-0 md:px-14 md:py-20"
                  }
                >
                  <div className="relative z-20 flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      section.status === "published"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {section.status === "published" ? "Published" : "Draft"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {section.sectionKey}
                    </span>
                  </div>

                  {section.eyebrow ? (
                    <p className={section.sectionKey === "hero" ? "relative z-20 mt-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300" : "mt-4 text-xs font-bold uppercase tracking-wider text-primary"}>
                      {section.eyebrow}
                    </p>
                  ) : null}

                  <h3 className={
                    section.sectionKey === "hero"
                      ? "relative z-20 mt-6 max-w-3xl text-4xl font-bold leading-tight md:text-6xl"
                      : "mt-4 max-w-3xl text-3xl font-bold"
                  }>
                    {section.title || "Judul belum diisi"}
                  </h3>

                  {section.subtitle ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {section.subtitle}
                    </p>
                  ) : null}

                  {section.body ? (
                    <p className={section.sectionKey === "hero" ? "relative z-20 mt-5 max-w-2xl whitespace-pre-line text-base leading-7 text-white/90" : "mt-4 whitespace-pre-line text-sm leading-7 text-slate-600"}>
                      {section.body}
                    </p>
                  ) : null}

                  {section.sectionKey==="hero" && heroImages.length ? (
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      <img src={`/api/public-site/admin/section?id=${section.id}&mode=hero&index=${heroSlide}&v=${imageVersion}`}
                        className="h-full w-full object-cover" alt="Hero"/>
                      <div className="absolute inset-0 bg-black/5" />
                      <div className="absolute inset-y-0 left-0 w-[60%] bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
                      <button type="button" onClick={()=>setHeroSlide((heroSlide-1+heroImages.length)%heroImages.length)}
                        className="absolute left-4 top-1/2 rounded-full bg-black/40 px-3 py-2 text-white">←</button>
                      <button type="button" onClick={()=>setHeroSlide((heroSlide+1)%heroImages.length)}
                        className="absolute right-4 top-1/2 rounded-full bg-black/40 px-3 py-2 text-white">→</button>
                      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                        {heroImages.map((_,i)=><button type="button" key={i} onClick={()=>setHeroSlide(i)}
                          className={`h-2.5 w-2.5 rounded-full ${i===heroSlide?"bg-white":"bg-white/40"}`}/>)}
                      </div>
                    </div>
                  ) : null}
                  {section.sectionKey==="about" ? (
                    <img
                      src={`/api/public-site/admin/section?id=${section.id}&v=${imageVersion}`}
                      key={`${section.id}-${imageVersion}`}
                      alt={section.title}
                      className="mt-8 h-72 w-full rounded-3xl object-cover md:absolute md:right-[6%] md:top-20 md:mt-0 md:h-[360px] md:w-[40%]"
                      onError={(e)=>e.currentTarget.classList.add("hidden")}
                      onLoad={(e)=>e.currentTarget.classList.remove("hidden")}
                    />
                  ) : null}

                  {section.sectionKey==="impact" ? (
                    <div className="mt-8 overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_20px_60px_rgba(16,24,40,0.12)] md:absolute md:right-[6%] md:top-24 md:mt-0 md:w-[42%]">
                      <div className="relative overflow-hidden rounded-[22px]">
                        <img
                          src={`/api/public-site/admin/section?id=${section.id}&v=${imageVersion}`}
                          alt={section.title}
                          className="h-72 w-full object-cover md:h-[340px]"
                          onError={(e)=>e.currentTarget.classList.add("hidden")}
                      onLoad={(e)=>e.currentTarget.classList.remove("hidden")}
                        />
                        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-900 backdrop-blur">
                          Ekosistem • Kolaborasi • Bertumbuh
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {section.sectionKey==="impact" ? (
                    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 md:absolute md:bottom-20 md:left-[6%] md:right-[6%]">
                      {impactFields.map(([vk,lk,dv,dl]) => {
                        const c=parseContent(section.contentJson);
                        return <div key={vk} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                          <div className="text-3xl font-bold text-emerald-900">{c[vk] || dv}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-700">{c[lk] || dl}</div>
                        </div>;
                      })}
                    </div>
                  ) : null}

                  {section.sectionKey==="programs" ? (
                    <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                      {(parseContent(section.contentJson).programs || defaultPrograms)
                        .filter((item:any)=>item.isVisible!==false)
                        .map((item:any,i:number)=>(
                          <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                            <img
                              src={`/api/public-site/admin/section?id=${section.id}&mode=program&index=${i}&v=${imageVersion}`}
                              alt={item.title}
                              className="-mx-5 -mt-5 mb-5 h-40 w-[calc(100%+2.5rem)] object-cover"
                              onError={e=>e.currentTarget.classList.add("hidden")}
                              onLoad={e=>e.currentTarget.classList.remove("hidden")}
                            />
                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                              Program {i+1}
                            </div>
                            <h4 className="mt-3 text-xl font-bold text-white">
                              {item.title}
                            </h4>
                            <p className="mt-3 text-sm leading-6 text-white/70">
                              {item.description}
                            </p>
                            {item.ctaLabel ? (
                              <span className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-950">
                                {item.ctaLabel}
                              </span>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  ) : null}

                  {section.sectionKey==="business-directory" ? (
                    <HighlightMarquee
                      items={publishedBusinesses}
                      variant="business"
                    />
                  ) : null}

                  {section.sectionKey==="testimonials" ? (
                    <HighlightMarquee
                      items={publishedTestimonials}
                      variant="testimonial"
                    />
                  ) : null}

                  {(section.primaryCtaLabel || section.secondaryCtaLabel) ? (
                    <div className="relative z-20 mt-7 flex flex-wrap gap-3">
                      {section.primaryCtaLabel ? (
                        <span className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
                          {section.primaryCtaLabel}
                        </span>
                      ) : null}

                      {section.secondaryCtaLabel ? (
                        <span className="inline-block rounded-xl border px-4 py-2 text-sm font-semibold">
                          {section.secondaryCtaLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
