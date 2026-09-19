"use client";

import { useState, type FormEvent } from "react";
import { PhotoCropEditor } from "@/components/public-site/photo-crop-editor";

async function readFormResponse(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch {
    if (response.status === 413 || text.includes("Payload Too Large"))
      throw new Error("Ukuran file terlalu besar. Maksimal 5 MB per foto.");
    throw new Error("Data belum berhasil dikirim. Silakan coba kembali.");
  }
}

async function preparePhoto(file: File) {
  const image = await new Promise<HTMLImageElement>((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); };
    img.onerror=()=>reject(new Error("Foto tidak dapat dibaca."));
    img.src=url;
  });

  const canvas=document.createElement("canvas");
  canvas.width=1600;
  canvas.height=1200;

  const ctx=canvas.getContext("2d")!;
  ctx.fillStyle="#f8fafc";
  ctx.fillRect(0,0,1600,1200);

  const scale=Math.min(1600/image.width,1200/image.height,1);
  const w=image.width*scale, h=image.height*scale;
  ctx.drawImage(image,(1600-w)/2,(1200-h)/2,w,h);

  const blob=await new Promise<Blob>((resolve,reject)=>
    canvas.toBlob(b=>b?resolve(b):reject(new Error("Foto gagal dikompres.")),"image/jpeg",0.82)
  );

  return new File([blob],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
}

export default function MemberPublicForm() {
  const [editingBusinessPhoto,setEditingBusinessPhoto]=useState<File|null>(null);
  const [editingProfilePhoto,setEditingProfilePhoto]=useState<File|null>(null);
  const [form,setForm]=useState({
    memberName:"",tdaPassport:"",whatsapp:"",
    businessName:"",businessCategory:"",businessDescription:"",
    businessLocation:"",instagramUrl:"",websiteUrl:"",marketplaceUrl:"",
    positionTitle:"",testimonial:"",consent:false,
  });
  const update=(key:string,value:string|boolean)=>
    setForm(current=>({...current,[key]:value}));
  const [logo,setLogo]=useState<File|null>(null);
  const [businessPhoto,setBusinessPhoto]=useState<File|null>(null);
  const [profilePhoto,setProfilePhoto]=useState<File|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const [submitted,setSubmitted]=useState(false);
  async function handleSubmit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSubmitting(true); setSubmitError("");
    try {
      const body=new FormData();
      Object.entries(form).forEach(([k,v])=>body.append(k,String(v)));
      if(logo) body.append("logo",logo);
      if(businessPhoto) body.append("businessPhoto",businessPhoto);
      if(profilePhoto) body.append("profilePhoto",profilePhoto);
      const r=await fetch("/api/public/member-submission",{method:"POST",body});
      const p=await r.json();
      if(!r.ok) throw new Error(p.error||"Data belum dapat dikirim.");
      setSubmitted(true);
    } catch(e){setSubmitError(e instanceof Error?e.message:"Gagal mengirim data.");}
    finally{setSubmitting(false);}
  }

  if(submitted) return (
    <main className="min-h-screen bg-[#f4f7f5] px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border bg-white p-10 text-center shadow-sm">
        <div className="text-5xl">✓</div>
        <h1 className="mt-5 text-2xl font-bold">Data Berhasil Dikirim</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Terima kasih. Data Anda sudah masuk dan sedang menunggu review admin TDA Pekanbaru.
        </p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Status: Menunggu Review
        </p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f4f7f5] px-4 py-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border bg-white shadow-sm">
        <header className="bg-[#123c2d] px-6 py-8 text-white md:px-10">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">TDA Pekanbaru 9.0</p>
          <h1 className="mt-3 text-3xl font-bold">Profil Usaha & Testimoni Member</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
            Lengkapi profil usaha dan pengalaman Anda bersama TDA Pekanbaru.
          </p>
        </header>
        <form onSubmit={handleSubmit} className="space-y-8 p-6 md:p-10">
<section className="border-b pb-8">
<div className="flex items-start gap-4">
  <span className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white">01</span>
  <div><h2 className="text-xl font-bold text-slate-900">Data Member</h2>
  <p className="mt-1 text-sm text-slate-500">Informasi dasar member TDA Pekanbaru.</p></div>
</div>
<div className="mt-6 grid gap-5 md:grid-cols-2">
  <label className="text-sm font-semibold">Nama Member <span className="text-red-500">*</span>
    <input required placeholder="Contoh: Agus Trianto" value={form.memberName} onChange={e=>update("memberName",e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/>
  </label>
  <label className="text-sm font-semibold">Nomor TDA Passport <span className="font-normal text-slate-400">(opsional)</span>
    <input placeholder="Nomor TDA Passport" value={form.tdaPassport} onChange={e=>update("tdaPassport",e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/>
  </label>
  <label className="text-sm font-semibold md:col-span-2">Nomor WhatsApp <span className="text-red-500">*</span>
    <input required placeholder="Contoh: 081234567890" value={form.whatsapp} onChange={e=>update("whatsapp",e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/>
  </label>
</div>
</section>
<section className="border-b pb-8">
<div className="flex items-start gap-4">
  <span className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white">02</span>
  <div><h2 className="text-xl font-bold">Profil Usaha</h2>
  <p className="mt-1 text-sm text-slate-500">Informasi yang akan menjadi profil usaha di website.</p></div>
</div>
<div className="mt-6 grid gap-5 md:grid-cols-2">
  {[
    ["businessName","Nama / Brand Usaha","Contoh: Akuntakita",true],
    ["businessCategory","Bidang Usaha","Contoh: Jasa Akuntansi",false],
    ["businessLocation","Lokasi Usaha","Contoh: Pekanbaru, Riau",false],
    ["instagramUrl","Instagram Usaha","Contoh: @namausaha",false],
    ["websiteUrl","Website","https://...",false],
    ["marketplaceUrl","Marketplace","Link toko / marketplace",false],
  ].map(([field,label,placeholder,required]:any)=>(
    <label key={field} className="text-sm font-semibold">
      {label} {required?<span className="text-red-500">*</span>:null}
      <input required={required} placeholder={placeholder} value={form[field]||""}
        onChange={e=>update(field,e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/>
    </label>
  ))}
  <label className="text-sm font-semibold md:col-span-2">Deskripsi Singkat Usaha
    <textarea placeholder="Ceritakan secara singkat produk, layanan, atau keunggulan usaha Anda." value={form.businessDescription}
      onChange={e=>update("businessDescription",e.target.value)} className="mt-2 min-h-32 w-full rounded-xl border px-4 py-3 font-normal"/>
  </label>
</div>
</section>
<section className="border-b pb-8">
<div className="flex items-start gap-4">
  <span className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white">03</span>
  <div>
    <h2 className="text-xl font-bold">Foto & Logo</h2>
    <p className="mt-1 text-sm text-slate-500">Gunakan visual terbaik yang mewakili usaha Anda.</p>
  </div>
</div>

<div className="mt-5 grid gap-4 md:grid-cols-2">
  <div className="rounded-2xl border bg-slate-50 p-5">
    <p className="font-semibold">Logo Usaha <span className="font-normal text-slate-400">(opsional)</span></p>
    <p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP • Maks. 5 MB</p>

    <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-white px-4 py-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
      {logo ? "Ganti Logo Usaha" : "+ Pilih Logo Usaha"}
      <input type="file" accept=".jpg,.jpeg,.png,.webp"
        onChange={e=>setLogo(e.target.files?.[0]||null)} className="hidden"/>
    </label>

    {logo ? <p className="mt-3 truncate text-xs text-slate-600">✓ {logo.name}</p> : null}
  </div>

  <div className="rounded-2xl border bg-slate-50 p-5">
    <p className="font-semibold">Foto Produk / Tempat Usaha</p>
    <p className="mt-1 text-xs text-slate-500">Pilih foto utama yang paling mewakili bisnis Anda.</p>

    <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-white px-4 py-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
      {businessPhoto ? "Ganti Foto Usaha" : "+ Pilih Foto Usaha"}
      <input type="file" accept=".jpg,.jpeg,.png,.webp"
        onChange={e=>setEditingBusinessPhoto(e.target.files?.[0]||null)} className="hidden"/>
    </label>

    {businessPhoto ? <p className="mt-3 truncate text-xs text-slate-600">✓ {businessPhoto.name}</p> : null}
    {editingBusinessPhoto ? (
      <div className="mt-4">
        <PhotoCropEditor
          file={editingBusinessPhoto}
          onCancel={()=>setEditingBusinessPhoto(null)}
          onApply={file=>{setBusinessPhoto(file);setEditingBusinessPhoto(null);}}
        />
      </div>
    ) : null}
  </div>
</div>
</section>

<section className="border-b pb-8">
<div className="flex items-start gap-4">
  <span className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white">04</span>
  <div>
    <h2 className="text-xl font-bold">Testimoni Member</h2>
    <p className="mt-1 text-sm text-slate-500">Bagikan pengalaman Anda tumbuh bersama TDA Pekanbaru.</p>
  </div>
</div>
<div className="mt-6 grid gap-5">
<input placeholder="Jabatan / Posisi di Usaha (opsional)" value={form.positionTitle} onChange={e=>update("positionTitle",e.target.value)} className="rounded-xl border p-3"/>
<textarea placeholder="Ceritakan pengalaman Anda bersama TDA Pekanbaru" value={form.testimonial} onChange={e=>update("testimonial",e.target.value)} className="min-h-32 rounded-xl border p-3"/>
<div className="rounded-2xl border bg-slate-50 p-5">
  <p className="font-semibold">Foto Member untuk Testimoni</p>
  <p className="mt-1 text-xs leading-5 text-slate-500">
    Foto ini akan digunakan pada kartu testimoni jika testimoni Anda dipublikasikan.
  </p>

  <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-white px-4 py-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
    {profilePhoto ? "Ganti Foto Member" : "+ Pilih Foto Member"}
    <input type="file" accept=".jpg,.jpeg,.png,.webp"
      onChange={e=>setEditingProfilePhoto(e.target.files?.[0]||null)} className="hidden"/>
  </label>

  {profilePhoto ? <p className="mt-3 truncate text-xs text-slate-600">✓ {profilePhoto.name}</p> : null}
  {editingProfilePhoto ? (
    <div className="mt-4">
      <PhotoCropEditor
        file={editingProfilePhoto}
        onCancel={()=>setEditingProfilePhoto(null)}
        onApply={file=>{setProfilePhoto(file);setEditingProfilePhoto(null);}}
      />
    </div>
  ) : null}
</div>
</div></section>

<section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 md:p-6">
<label className="flex items-start gap-3 text-sm">
<input required type="checkbox" checked={form.consent}
  onChange={e=>update("consent",e.target.checked)} className="mt-1"/>
<span>Saya memahami bahwa data profil usaha, foto, dan testimoni yang saya kirim dapat dipublikasikan di website TDA Pekanbaru setelah melalui review admin. Nomor WhatsApp tidak akan dipublikasikan dan hanya digunakan untuk komunikasi atau verifikasi oleh admin TDA Pekanbaru.</span>
</label>
</section>

{submitError ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{submitError}</p> : null}

<div className="pt-2">
  {editingBusinessPhoto || editingProfilePhoto ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
      <p className="text-sm font-semibold text-amber-800">
        Selesaikan pengaturan foto terlebih dahulu.
      </p>
      <p className="mt-1 text-xs text-amber-700">
        Klik “Gunakan Foto” pada foto yang sedang diedit agar tombol kirim tersedia.
      </p>
    </div>
  ) : (
    <>
      <button disabled={submitting}
        className="h-14 w-full rounded-xl bg-emerald-800 px-6 text-base font-bold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
        {submitting ? "Sedang Mengirim…" : "Kirim Profil & Testimoni"}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        Data akan masuk ke tahap review admin sebelum dipublikasikan.
      </p>
    </>
  )}
</div>
</form>
      </div>
    </main>
  );
}
