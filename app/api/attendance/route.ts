import {
  accessErrorResponse,
  requireRegisteredUser,
} from "@/db/access-control";
import {
  checkInParticipant,
  checkInParticipantByToken,
  createAttendanceEvent,
  createParticipant,
  deleteAttendanceEvent,
  deleteAttendanceFile,
  deleteParticipant,
  deletePaymentVerification,
  getAttendanceParticipant,
  getPublicEvent,
  listAttendance,
  listAttendanceParticipants,
  listFastCheckIn,
  receiveOnsitePayment,
  saveAttendanceFile,
  setEventFlyer,
  setEventQris,
  setPaymentStatus,
  setRegistrationOpen,
  updateAttendanceEvent,
} from "@/db/attendance";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const proofTypes = new Set([...imageTypes, "application/pdf"]);
function amount(value: FormDataEntryValue | null) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export async function GET(request: Request) {
  try {
    await requireRegisteredUser();
    const url = new URL(request.url);
    const eventId = Number(url.searchParams.get("eventId"));
    if (url.searchParams.get("scope") === "fast-checkin") {
      return Response.json(await listFastCheckIn(eventId || undefined));
    }
    if (url.searchParams.get("scope") === "participants") {
      if (!eventId)
        return Response.json({ error: "Event tidak valid." }, { status: 400 });
      return Response.json({
        participants: await listAttendanceParticipants(eventId),
      });
    }
    return Response.json(await listAttendance(eventId || undefined));
  } catch (reason) {
    return accessErrorResponse(reason, "Data kehadiran belum dapat dimuat.");
  }
}

export async function POST(request: Request) {
  let uploadedKey: string | null = null;
  try {
    const user = await requireRegisteredUser();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = String(form.get("action"));
      if (action === "onsite-payment") {
        const participantId = Number(form.get("participantId"));
        const accountId = Number(form.get("accountId"));
        const receivedAmount = amount(form.get("receivedAmount"));
        const paidAt = String(form.get("paidAt") ?? "").trim();
        if (!participantId || !accountId || receivedAmount <= 0 || !paidAt) {
          return Response.json(
            {
              error:
                "Peserta, rekening, nominal, dan waktu pembayaran wajib diisi.",
            },
            { status: 400 },
          );
        }
        const proof = form.get("proof");
        if (proof instanceof File && proof.size > 0) {
          if (proof.size > 8 * 1024 * 1024)
            return Response.json(
              { error: "Ukuran bukti maksimal 8 MB." },
              { status: 400 },
            );
          if (!proofTypes.has(proof.type))
            return Response.json(
              { error: "Bukti harus berupa PDF, JPG, PNG, atau WebP." },
              { status: 400 },
            );
          uploadedKey = await saveAttendanceFile(
            `attendance-payments/onsite/${participantId}`,
            proof,
          );
        }
        const participant = await receiveOnsitePayment(
          {
            participantId,
            accountId,
            method: String(form.get("method") ?? "Tunai").trim(),
            amount: receivedAmount,
            paidAt,
            note: String(form.get("note") ?? "").trim(),
            proofKey: uploadedKey,
            proofName:
              proof instanceof File && proof.size > 0
                ? proof.name.slice(0, 180)
                : null,
            proofType:
              proof instanceof File && proof.size > 0 ? proof.type : null,
          },
          user.id,
        );
        uploadedKey = null;
        return Response.json({ participant });
      }
      if (action !== "event")
        return Response.json(
          { error: "Aksi tidak dikenali." },
          { status: 400 },
        );
      const name = String(form.get("name") ?? "").trim();
      const eventDate = String(form.get("eventDate") ?? "").trim();
      const isPaid = String(form.get("isPaid")) === "true";
      if (!name || !eventDate)
        return Response.json(
          { error: "Nama dan tanggal event wajib diisi." },
          { status: 400 },
        );
      const qris = form.get("qris");
      const flyer = form.get("flyer");
      if (qris instanceof File && qris.size > 0) {
        if (qris.size > 5 * 1024 * 1024)
          return Response.json(
            { error: "Ukuran QRIS maksimal 5 MB." },
            { status: 400 },
          );
        if (!imageTypes.has(qris.type))
          return Response.json(
            { error: "QRIS harus berupa JPG, PNG, atau WebP." },
            { status: 400 },
          );
      }
      if (flyer instanceof File && flyer.size > 0) {
        if (flyer.size > 5 * 1024 * 1024)
          return Response.json(
            { error: "Ukuran flyer maksimal 5 MB." },
            { status: 400 },
          );
        if (!imageTypes.has(flyer.type))
          return Response.json(
            { error: "Flyer harus berupa JPG, PNG, atau WebP." },
            { status: 400 },
          );
      }
      const eventId = Number(form.get("eventId"));
      const input = {
        programId: Number(form.get("programId")) || null,
        incomeTaskId: Number(form.get("incomeTaskId")) || null,
        name,
        publicTitle: String(form.get("publicTitle") ?? "").trim(),
        collaborationPartner: String(
          form.get("collaborationPartner") ?? "",
        ).trim(),
        isCollaboration:
          !Number(form.get("programId")) &&
          String(form.get("isCollaboration")) === "true",
        eventDate,
        treasuryAccountId: Number(form.get("treasuryAccountId")) || null,
        startTime: String(form.get("startTime") ?? ""),
        endTime: String(form.get("endTime") ?? ""),
        location: String(form.get("location") ?? ""),
        isPaid,
        publicPrice: amount(form.get("publicPrice")),
        memberPrice: amount(form.get("memberPrice")),
        committeePrice: amount(form.get("committeePrice")),
        allowPublicCategory: String(form.get("allowPublicCategory")) === "true",
        allowMemberCategory: String(form.get("allowMemberCategory")) === "true",
        allowCommitteeCategory:
          String(form.get("allowCommitteeCategory")) === "true",
        earlyBirdPublicPrice: amount(form.get("earlyBirdPublicPrice")),
        earlyBirdMemberPrice: amount(form.get("earlyBirdMemberPrice")),
        earlyBirdCommitteePrice: amount(form.get("earlyBirdCommitteePrice")),
        earlyBirdEndsAt: String(form.get("earlyBirdEndsAt") ?? ""),
        bankName: String(form.get("bankName") ?? "").trim(),
        bankAccountNumber: String(form.get("bankAccountNumber") ?? "").trim(),
        bankAccountName: String(form.get("bankAccountName") ?? "").trim(),
        paymentInstructions: String(
          form.get("paymentInstructions") ?? "",
        ).trim(),
      };
      if (input.isCollaboration && !input.collaborationPartner) {
        return Response.json(
          {
            error:
              "Nama penyelenggara/mitra wajib diisi untuk event kolaborasi.",
          },
          { status: 400 },
        );
      }
      if (
        !input.allowPublicCategory &&
        !input.allowMemberCategory &&
        !input.allowCommitteeCategory
      ) {
        return Response.json(
          { error: "Pilih minimal satu kategori peserta." },
          { status: 400 },
        );
      }
      const id = eventId || (await createAttendanceEvent(input, user.id));
      if (eventId && !(await updateAttendanceEvent(eventId, input))) {
        return Response.json(
          { error: "Event tidak ditemukan." },
          { status: 404 },
        );
      }
      if (qris instanceof File && qris.size > 0) {
        const previous = eventId ? await getPublicEvent(eventId) : null;
        uploadedKey = await saveAttendanceFile(`attendance-qris/${id}`, qris);
        await setEventQris(id, uploadedKey, qris.name.slice(0, 180), qris.type);
        if (previous?.qrisKey)
          await deleteAttendanceFile(previous.qrisKey).catch(() => undefined);
      }
      if (flyer instanceof File && flyer.size > 0) {
        const previous = eventId ? await getPublicEvent(eventId) : null;
        uploadedKey = await saveAttendanceFile(
          `attendance-flyers/${id}`,
          flyer,
        );
        await setEventFlyer(
          id,
          uploadedKey,
          flyer.name.slice(0, 180),
          flyer.type,
        );
        if (previous?.flyerKey)
          await deleteAttendanceFile(previous.flyerKey).catch(() => undefined);
        uploadedKey = null;
      }
      return Response.json(
        { id, event: await getPublicEvent(id) },
        { status: eventId ? 200 : 201 },
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "event") {
      const name = String(body.name ?? "").trim();
      const eventDate = String(body.eventDate ?? "").trim();
      if (!name || !eventDate)
        return Response.json(
          { error: "Nama dan tanggal event wajib diisi." },
          { status: 400 },
        );
      const id = await createAttendanceEvent(
        {
          programId: Number(body.programId) || null,
          incomeTaskId: null,
          name,
          publicTitle: String(body.publicTitle ?? ""),
          collaborationPartner: String(body.collaborationPartner ?? ""),
          isCollaboration:
            !Number(body.programId) && Boolean(body.isCollaboration),
          eventDate,
          treasuryAccountId: null,
          startTime: String(body.startTime ?? ""),
          endTime: String(body.endTime ?? ""),
          location: String(body.location ?? ""),
          isPaid: false,
          publicPrice: 0,
          memberPrice: 0,
          committeePrice: 0,
          allowPublicCategory: true,
          allowMemberCategory: true,
          allowCommitteeCategory: true,
          earlyBirdPublicPrice: 0,
          earlyBirdMemberPrice: 0,
          earlyBirdCommitteePrice: 0,
          earlyBirdEndsAt: "",
          bankName: "",
          bankAccountNumber: "",
          bankAccountName: "",
          paymentInstructions: "",
        },
        user.id,
      );
      return Response.json({ id }, { status: 201 });
    }
    if (action === "participant") {
      const eventId = Number(body.eventId);
      const name = String(body.name ?? "").trim();
      const phone = String(body.phone ?? "").trim();
      if (!eventId || !name || !phone)
        return Response.json(
          { error: "Event, nama, dan WhatsApp wajib diisi." },
          { status: 400 },
        );
      const id = await createParticipant(
        {
          eventId,
          name,
          phone,
          category: String(body.category ?? "Member"),
          organization: String(body.organization ?? ""),
        },
        user.id,
        Boolean(body.checkIn),
      );
      return Response.json({ id }, { status: 201 });
    }
    if (action === "checkin") {
      const result = await checkInParticipant(
        Number(body.id),
        user.id,
        String(body.method ?? "manual"),
      );
      if (result.status === "payment_required")
        return Response.json(
          { error: "Pembayaran peserta belum lunas atau belum diverifikasi." },
          { status: 402 },
        );
      if (result.status !== "checked_in")
        return Response.json(
          { error: "Peserta sudah check-in atau tidak ditemukan." },
          { status: 409 },
        );
      return Response.json({ ok: true });
    }
    if (action === "checkin-token") {
      const result = await checkInParticipantByToken(
        Number(body.eventId),
        String(body.token ?? "").trim(),
        user.id,
      );
      if (result.status === "not_found")
        return Response.json(
          { error: "QR tidak cocok dengan peserta event ini." },
          { status: 404 },
        );
      if (result.status === "already_checked_in")
        return Response.json(
          { error: `${result.participant.name} sudah check-in sebelumnya.` },
          { status: 409 },
        );
      if (result.status === "payment_required")
        return Response.json(
          {
            error: `${result.participant.name} belum memiliki pembayaran yang terverifikasi.`,
            participant: await getAttendanceParticipant(result.participant.id),
          },
          { status: 402 },
        );
      return Response.json({ ok: true, participant: result.participant });
    }
    if (action === "delete") {
      await deleteParticipant(Number(body.id));
      return Response.json({ ok: true });
    }
    if (action === "delete-event") {
      const deleted = await deleteAttendanceEvent(Number(body.eventId));
      if (!deleted)
        return Response.json(
          { error: "Event tidak ditemukan." },
          { status: 404 },
        );
      return Response.json({ ok: true });
    }
    if (action === "registration") {
      await setRegistrationOpen(Number(body.eventId), Boolean(body.open));
      return Response.json({ ok: true });
    }
    if (action === "payment-status") {
      const status = String(body.status);
      if (status !== "paid" && status !== "rejected")
        return Response.json(
          { error: "Status pembayaran tidak valid." },
          { status: 400 },
        );
      const participant = await getAttendanceParticipant(Number(body.id));
      if (participant?.paymentStatus === "onsite_pending") {
        return Response.json(
          {
            error:
              "Pembayaran di lokasi harus diperiksa melalui menu Bendahara.",
          },
          { status: 409 },
        );
      }
      const source = String(body.source ?? "system_proof");
      const allowedSources = new Set([
        "system_proof",
        "whatsapp",
        "bank_mutation",
        "cash",
        "other",
      ]);
      if (!allowedSources.has(source))
        return Response.json(
          { error: "Sumber verifikasi tidak valid." },
          { status: 400 },
        );
      const changed = await setPaymentStatus(
        Number(body.id),
        status,
        String(body.note ?? "").trim(),
        user.id,
        {
          source,
          method: String(body.method ?? "").trim(),
          receivedAmount: Math.max(
            0,
            Math.round(Number(body.receivedAmount) || 0),
          ),
          paidAt: String(body.paidAt ?? "").trim(),
        },
      );
      if (!changed)
        return Response.json(
          { error: "Peserta tidak ditemukan." },
          { status: 404 },
        );
      return Response.json({ ok: true });
    }
    if (action === "delete-payment-verification") {
      const result = await deletePaymentVerification(Number(body.id));
      if (!result)
        return Response.json(
          { error: "Peserta tidak ditemukan." },
          { status: 404 },
        );
      return Response.json({ ok: true, status: result.status });
    }
    return Response.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (reason) {
    if (uploadedKey)
      await deleteAttendanceFile(uploadedKey).catch(() => undefined);
    return accessErrorResponse(reason, "Data kehadiran belum dapat disimpan.");
  }
}
