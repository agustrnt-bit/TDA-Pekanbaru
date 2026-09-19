"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Camera,
  CameraOff,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Keyboard,
  LockKeyhole,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  UserCheck,
  Users,
  UserX,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getCachedJson, invalidateClientCache } from "@/lib/client-cache";

type EventRow = {
  id: number;
  programId: number | null;
  incomeTaskId: number | null;
  programCode: string | null;
  programTitle: string | null;
  name: string;
  publicTitle: string;
  collaborationPartner: string;
  isCollaboration: number;
  flyerKey: string | null;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  registrationOpen: number;
  feedbackOpen: number;
  isPaid: number;
  treasuryAccountId: number | null;
  publicPrice: number;
  memberPrice: number;
  committeePrice: number;
  allowPublicCategory: number;
  allowMemberCategory: number;
  allowCommitteeCategory: number;
  earlyBirdPublicPrice: number;
  earlyBirdMemberPrice: number;
  earlyBirdCommitteePrice: number;
  earlyBirdEndsAt: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
  qrisKey: string | null;
};
type Participant = {
  id: number;
  eventId: number;
  name: string;
  phone: string;
  category: string;
  organization: string;
  passportNumber: string;
  amountDue: number;
  priceLabel: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentProofKey: string | null;
  paymentProofName: string | null;
  paymentConfirmedAt: string | null;
  paymentNote: string;
  paymentVerificationSource: string;
  paymentReceivedAmount: number;
  paymentPaidAt: string | null;
  paymentTreasuryAccountId: number | null;
  paymentReceivedByUserId: number | null;
  paymentReceivedAt: string | null;
  qrToken: string;
  checkedInAt: string | null;
  checkInMethod: string | null;
};
type Program = {
  id: number;
  programCode: string;
  title: string;
  divisionName: string;
};
type AttendanceTask = { id: number; programId: number; title: string };
type TreasuryAccount = {
  id: number;
  name: string;
  type: "bank" | "cash";
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};
type Tab = "dashboard" | "participants" | "payments" | "checkin" | "report";
type ScanOutcome = { name: string; pending?: boolean };
type AttendanceSnapshot = {
  events: EventRow[];
  participants: Participant[];
  programs: Program[];
  attendanceTasks: AttendanceTask[];
  treasuryAccounts: TreasuryAccount[];
  eventId: number;
  savedAt: number;
};

let attendanceSnapshot: AttendanceSnapshot | null = null;

const categories = [
  "Member TDA",
  "Pengurus TDA",
  "Umum",
  "Undangan",
  "Narasumber",
];
const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const publicSiteOrigin = "https://tdapku.my.id";
const emptyEventForm = {
  programId: "",
  incomeTaskId: "",
  name: "",
  publicTitle: "",
  collaborationPartner: "",
  isCollaboration: false,
  eventDate: "",
  startTime: "",
  endTime: "",
  location: "",
  isPaid: false,
  treasuryAccountId: "",
  publicPrice: "",
  memberPrice: "",
  committeePrice: "",
  allowPublicCategory: true,
  allowMemberCategory: true,
  allowCommitteeCategory: true,
  earlyBirdPublicPrice: "",
  earlyBirdMemberPrice: "",
  earlyBirdCommitteePrice: "",
  earlyBirdEndsAt: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
  paymentInstructions: "",
};
function currentJakartaDateTime() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
function eventToForm(event: EventRow) {
  return {
    programId: event.programId ? String(event.programId) : "",
    incomeTaskId: event.incomeTaskId ? String(event.incomeTaskId) : "",
    name: event.name,
    publicTitle: event.publicTitle,
    collaborationPartner: event.collaborationPartner,
    isCollaboration: Boolean(event.isCollaboration),
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    isPaid: Boolean(event.isPaid),
    treasuryAccountId: event.treasuryAccountId
      ? String(event.treasuryAccountId)
      : "",
    publicPrice: String(event.publicPrice),
    memberPrice: String(event.memberPrice),
    committeePrice: String(event.committeePrice),
    allowPublicCategory: Boolean(event.allowPublicCategory),
    allowMemberCategory: Boolean(event.allowMemberCategory),
    allowCommitteeCategory: Boolean(event.allowCommitteeCategory),
    earlyBirdPublicPrice: String(event.earlyBirdPublicPrice),
    earlyBirdMemberPrice: String(event.earlyBirdMemberPrice),
    earlyBirdCommitteePrice: String(event.earlyBirdCommitteePrice),
    earlyBirdEndsAt: event.earlyBirdEndsAt,
    bankName: event.bankName,
    bankAccountNumber: event.bankAccountNumber,
    bankAccountName: event.bankAccountName,
    paymentInstructions: event.paymentInstructions,
  };
}

export default function AttendanceApp({
  fastMode = false,
}: {
  fastMode?: boolean;
}) {
  const initialSnapshot = fastMode ? null : attendanceSnapshot;
  const [events, setEvents] = useState<EventRow[]>(
    () => initialSnapshot?.events ?? [],
  );
  const [participants, setParticipants] = useState<Participant[]>(
    () => initialSnapshot?.participants ?? [],
  );
  const [programs, setPrograms] = useState<Program[]>(
    () => initialSnapshot?.programs ?? [],
  );
  const [attendanceTasks, setAttendanceTasks] = useState<AttendanceTask[]>(
    () => initialSnapshot?.attendanceTasks ?? [],
  );
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>(
    () => initialSnapshot?.treasuryAccounts ?? [],
  );
  const [eventId, setEventId] = useState(() => initialSnapshot?.eventId ?? 0);
  const [tab, setTab] = useState<Tab>(fastMode ? "checkin" : "dashboard");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(() => !initialSnapshot);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const participantRequest = useRef(0);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [deleteEventDialog, setDeleteEventDialog] = useState<EventRow | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    category: "Member TDA",
    organization: "",
    checkIn: false,
  });
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [qris, setQris] = useState<File | null>(null);
  const [flyer, setFlyer] = useState<File | null>(null);
  const [paymentNote, setPaymentNote] = useState<Record<number, string>>({});
  const [paymentDialog, setPaymentDialog] = useState<Participant | null>(null);
  const [deletePaymentDialog, setDeletePaymentDialog] =
    useState<Participant | null>(null);
  const [onsiteParticipant, setOnsiteParticipant] =
    useState<Participant | null>(null);
  const [onsiteProof, setOnsiteProof] = useState<File | null>(null);
  const [onsiteForm, setOnsiteForm] = useState({
    method: "Tunai",
    accountId: "",
    receivedAmount: "",
    paidAt: "",
    note: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    source: "whatsapp",
    method: "Transfer Bank",
    receivedAmount: "",
    paidAt: "",
    note: "",
  });
  const [online, setOnline] = useState(true);
  const [pendingTokens, setPendingTokens] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const autoSyncAttempted = useRef(false);

  async function load(targetEventId?: number, background = false) {
    try {
      const params = new URLSearchParams();
      if (targetEventId) params.set("eventId", String(targetEventId));
      if (fastMode) params.set("scope", "fast-checkin");
      const url = `/api/attendance${params.size ? `?${params}` : ""}`;
      const data = await getCachedJson<{
        events: EventRow[];
        participants: Participant[];
        programs?: Program[];
        attendanceTasks?: AttendanceTask[];
        treasuryAccounts?: TreasuryAccount[];
      }>(url, fastMode ? 5_000 : 30_000, background);
      setEvents(data.events);
      setParticipants(data.participants);
      setPrograms(data.programs ?? []);
      setAttendanceTasks(data.attendanceTasks ?? []);
      setTreasuryAccounts(data.treasuryAccounts ?? []);
      setEventId(targetEventId || data.events[0]?.id || 0);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Data belum dapat dimuat.",
      );
    } finally {
      if (!background) setLoading(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(
      () => void load(initialSnapshot?.eventId, Boolean(initialSnapshot)),
      0,
    );
    return () => window.clearTimeout(timer);
    // The initial snapshot is intentionally captured only once when this screen mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fastMode && !loading)
      attendanceSnapshot = {
        events,
        participants,
        programs,
        attendanceTasks,
        treasuryAccounts,
        eventId,
        savedAt: Date.now(),
      };
  }, [
    attendanceTasks,
    eventId,
    events,
    fastMode,
    loading,
    participants,
    programs,
    treasuryAccounts,
  ]);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!eventId) return;
    autoSyncAttempted.current = false;
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(
          window.localStorage.getItem(`tdapku-checkin-queue-${eventId}`) ||
            "[]",
        );
        setPendingTokens(
          Array.isArray(stored)
            ? stored.filter((item): item is string => typeof item === "string")
            : [],
        );
      } catch {
        setPendingTokens([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [eventId]);

  async function loadParticipants(targetEventId: number, background = false) {
    const requestId = ++participantRequest.current;
    if (!background) setParticipantsLoading(true);
    try {
      const response = await fetch(
        `/api/attendance?scope=participants&eventId=${targetEventId}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (requestId === participantRequest.current)
        setParticipants(data.participants);
    } catch (reason) {
      if (!background && requestId === participantRequest.current)
        toast.error(
          reason instanceof Error
            ? reason.message
            : "Peserta belum dapat dimuat.",
        );
    } finally {
      if (!background && requestId === participantRequest.current)
        setParticipantsLoading(false);
    }
  }

  useEffect(() => {
    if (
      !eventId ||
      participantOpen ||
      eventOpen ||
      paymentDialog ||
      deletePaymentDialog ||
      deleteEventDialog ||
      onsiteParticipant
    )
      return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void loadParticipants(eventId, true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [
    deleteEventDialog,
    deletePaymentDialog,
    eventId,
    eventOpen,
    onsiteParticipant,
    participantOpen,
    paymentDialog,
  ]);

  function selectEvent(nextEventId: number) {
    setEventId(nextEventId);
    setQuery("");
    setCategory("");
    void loadParticipants(nextEventId);
  }

  const activeEvent = events.find((event) => event.id === eventId);
  const rows = useMemo(
    () => participants.filter((participant) => participant.eventId === eventId),
    [participants, eventId],
  );
  const present = rows.filter((participant) => participant.checkedInAt);
  const filtered = rows.filter(
    (participant) =>
      (!query ||
        `${participant.name} ${participant.phone} ${participant.organization}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!category || participant.category === category),
  );
  const rate = rows.length
    ? Math.round((present.length / rows.length) * 100)
    : 0;
  const verifiedRevenue = rows
    .filter((participant) => participant.paymentStatus === "paid")
    .reduce((total, participant) => total + Number(participant.amountDue), 0);
  const waitingPayments = rows.filter(
    (participant) =>
      participant.paymentStatus === "verification" ||
      participant.paymentStatus === "onsite_pending",
  );

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
    invalidateClientCache("/api/attendance");
    return data;
  }

  async function addParticipant() {
    try {
      await post({ action: "participant", eventId, ...form });
      setParticipantOpen(false);
      setForm({
        name: "",
        phone: "",
        category: "Member TDA",
        organization: "",
        checkIn: false,
      });
      await loadParticipants(eventId);
      toast.success("Peserta berhasil ditambahkan.");
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Peserta belum dapat disimpan.",
      );
    }
  }

  function openNewEvent() {
    setEditingEventId(null);
    setEventForm(emptyEventForm);
    setQris(null);
    setFlyer(null);
    setEventOpen(true);
  }
  function openEditEvent(event: EventRow) {
    setEditingEventId(event.id);
    setEventForm(eventToForm(event));
    setQris(null);
    setFlyer(null);
    setEventOpen(true);
  }

  async function saveEvent() {
    try {
      const payload = new FormData();
      payload.set("action", "event");
      if (editingEventId) payload.set("eventId", String(editingEventId));
      Object.entries(eventForm).forEach(([key, value]) =>
        payload.set(key, String(value)),
      );
      if (qris) payload.set("qris", qris);
      if (flyer) payload.set("flyer", flyer);
      const response = await fetch("/api/attendance", {
        method: "POST",
        body: payload,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Event belum dapat disimpan.");
      setEventOpen(false);
      setEventForm(emptyEventForm);
      setQris(null);
      setFlyer(null);
      const saved = data.event as EventRow;
      setEvents((current) =>
        editingEventId
          ? current.map((event) => (event.id === saved.id ? saved : event))
          : [saved, ...current],
      );
      if (!editingEventId) {
        setEventId(saved.id);
        setParticipants([]);
      }
      toast.success(
        editingEventId
          ? "Perubahan event berhasil disimpan."
          : "Event berhasil dibuat.",
      );
      setEditingEventId(null);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Event belum dapat disimpan.",
      );
    }
  }
  async function removeEvent() {
    if (!deleteEventDialog) return;
    try {
      await post({ action: "delete-event", eventId: deleteEventDialog.id });
      const remaining = events.filter(
        (event) => event.id !== deleteEventDialog.id,
      );
      setEvents(remaining);
      setDeleteEventDialog(null);
      setQuery("");
      setCategory("");
      const nextId = remaining[0]?.id ?? 0;
      setEventId(nextId);
      setParticipants([]);
      if (nextId) void loadParticipants(nextId);
      toast.success("Event dan data terkait berhasil dihapus.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Event belum dapat dihapus.",
      );
    }
  }

  function openPaymentDialog(participant: Participant) {
    if (participant.paymentStatus === "onsite_pending") {
      toast.info(
        "Pembayaran di lokasi menunggu validasi melalui menu Bendahara.",
      );
      return;
    }
    const now = currentJakartaDateTime();
    setPaymentForm({
      source:
        participant.paymentVerificationSource ||
        (participant.paymentProofKey ? "system_proof" : "whatsapp"),
      method: participant.paymentMethod || "Transfer Bank",
      receivedAmount: String(
        participant.paymentReceivedAmount || participant.amountDue,
      ),
      paidAt: participant.paymentPaidAt
        ? participant.paymentPaidAt.replace(" ", "T").slice(0, 16)
        : now,
      note: participant.paymentNote || paymentNote[participant.id] || "",
    });
    setPaymentDialog(participant);
  }

  async function updatePayment(
    participant: Participant,
    status: "paid" | "rejected",
    details = paymentForm,
  ) {
    try {
      await post({
        action: "payment-status",
        id: participant.id,
        status,
        note:
          status === "paid"
            ? details.note
            : (paymentNote[participant.id] ?? ""),
        source: details.source,
        method: details.method,
        receivedAmount: details.receivedAmount,
        paidAt: details.paidAt,
      });
      setParticipants((current) =>
        current.map((item) =>
          item.id === participant.id
            ? {
                ...item,
                paymentStatus: status,
                paymentNote:
                  status === "paid"
                    ? details.note
                    : (paymentNote[participant.id] ?? ""),
                paymentMethod: details.method,
                paymentVerificationSource: details.source,
                paymentReceivedAmount:
                  status === "paid"
                    ? Math.max(
                        0,
                        Math.round(
                          Number(details.receivedAmount) || item.amountDue,
                        ),
                      )
                    : 0,
                paymentPaidAt: status === "paid" ? details.paidAt : null,
              }
            : item,
        ),
      );
      setPaymentDialog(null);
      toast.success(
        status === "paid"
          ? "Pembayaran ditutup sebagai lunas. QR peserta sudah aktif."
          : "Bukti pembayaran ditolak.",
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Status pembayaran belum dapat diperbarui.",
      );
    }
  }

  async function checkIn(participant: Participant, method = "manual") {
    if (
      participant.amountDue > 0 &&
      participant.paymentStatus !== "paid" &&
      participant.paymentStatus !== "not_required"
    ) {
      openOnsitePayment(participant);
      return;
    }
    try {
      await post({ action: "checkin", id: participant.id, method });
      setParticipants((current) =>
        current.map((item) =>
          item.id === participant.id
            ? {
                ...item,
                checkedInAt: new Date().toISOString(),
                checkInMethod: method,
              }
            : item,
        ),
      );
      toast.success(`${participant.name} berhasil check-in.`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Check-in gagal.");
    }
  }

  function savePendingQueue(next: string[]) {
    const unique = [...new Set(next)];
    setPendingTokens(unique);
    window.localStorage.setItem(
      `tdapku-checkin-queue-${eventId}`,
      JSON.stringify(unique),
    );
  }

  async function requestCheckInToken(token: string) {
    const response = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkin-token", eventId, token }),
    });
    const data = await response.json();
    return { response, data };
  }

  async function checkInToken(token: string): Promise<ScanOutcome> {
    try {
      const { response, data } = await requestCheckInToken(token);
      if (!response.ok) {
        if (response.status === 402 && data.participant)
          openOnsitePayment(data.participant as Participant);
        throw new Error(data.error || "Check-in gagal.");
      }
      setParticipants((current) =>
        current.map((item) =>
          item.id === Number(data.participant.id)
            ? {
                ...item,
                checkedInAt: new Date().toISOString(),
                checkInMethod: "qr",
              }
            : item,
        ),
      );
      return { name: String(data.participant.name) };
    } catch (reason) {
      const participant = participants.find((item) => item.qrToken === token);
      const canQueue =
        participant &&
        !participant.checkedInAt &&
        (participant.paymentStatus === "paid" ||
          participant.paymentStatus === "not_required");
      if ((reason instanceof TypeError || !navigator.onLine) && canQueue) {
        savePendingQueue([...pendingTokens, token]);
        setParticipants((current) =>
          current.map((item) =>
            item.id === participant.id
              ? {
                  ...item,
                  checkedInAt: new Date().toISOString(),
                  checkInMethod: "menunggu-sinkronisasi",
                }
              : item,
          ),
        );
        return { name: participant.name, pending: true };
      }
      throw reason;
    }
  }

  async function syncPendingCheckIns() {
    if (!pendingTokens.length || syncing || !navigator.onLine) return;
    setSyncing(true);
    const remaining: string[] = [];
    let synced = 0;
    for (let index = 0; index < pendingTokens.length; index += 1) {
      const token = pendingTokens[index];
      try {
        const { response, data } = await requestCheckInToken(token);
        if (response.ok || response.status === 409) {
          synced += 1;
          if (data.participant?.id)
            setParticipants((current) =>
              current.map((item) =>
                item.id === Number(data.participant.id)
                  ? {
                      ...item,
                      checkedInAt: item.checkedInAt || new Date().toISOString(),
                      checkInMethod: "qr",
                    }
                  : item,
              ),
            );
        } else {
          remaining.push(token);
        }
      } catch {
        remaining.push(token);
        if (!navigator.onLine) {
          remaining.push(...pendingTokens.slice(index + 1));
          break;
        }
      }
    }
    savePendingQueue(remaining);
    setSyncing(false);
    if (synced)
      toast.success(`${synced} check-in berhasil disinkronkan ke server.`);
    if (remaining.length)
      toast.warning(
        `${remaining.length} check-in masih menunggu sinkronisasi.`,
      );
  }

  useEffect(() => {
    if (!online) {
      autoSyncAttempted.current = false;
      return;
    }
    if (!pendingTokens.length || syncing || autoSyncAttempted.current) return;
    autoSyncAttempted.current = true;
    const timer = window.setTimeout(() => void syncPendingCheckIns(), 1200);
    return () => window.clearTimeout(timer);
    // Sync is intentionally retried once per connectivity transition; manual retry remains available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pendingTokens.length, syncing]);

  function openOnsitePayment(participant: Participant) {
    const defaultAccount =
      participant.paymentTreasuryAccountId ||
      activeEvent?.treasuryAccountId ||
      treasuryAccounts[0]?.id;
    setOnsiteForm({
      method: "Tunai",
      accountId: defaultAccount ? String(defaultAccount) : "",
      receivedAmount: String(
        participant.paymentReceivedAmount || participant.amountDue,
      ),
      paidAt: currentJakartaDateTime(),
      note: "",
    });
    setOnsiteProof(null);
    setOnsiteParticipant(participant);
  }

  async function receiveOnsiteAndCheckIn() {
    if (!onsiteParticipant) return;
    try {
      const payload = new FormData();
      payload.set("action", "onsite-payment");
      payload.set("participantId", String(onsiteParticipant.id));
      Object.entries(onsiteForm).forEach(([key, value]) =>
        payload.set(key, value),
      );
      if (onsiteProof) payload.set("proof", onsiteProof);
      const response = await fetch("/api/attendance", {
        method: "POST",
        body: payload,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Pembayaran belum dapat dicatat.");
      const updated = data.participant as Participant;
      setParticipants((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setOnsiteParticipant(null);
      setOnsiteProof(null);
      toast.success(
        `${updated.name} sudah dibayar di lokasi dan berhasil check-in.`,
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Pembayaran belum dapat dicatat.",
      );
    }
  }

  async function removeParticipant() {
    if (!deleteId) return;
    try {
      await post({ action: "delete", id: deleteId });
      setParticipants((current) =>
        current.filter((participant) => participant.id !== deleteId),
      );
      setDeleteId(null);
      toast.success("Peserta dihapus.");
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Peserta belum dapat dihapus.",
      );
    }
  }

  async function removePaymentVerification() {
    if (!deletePaymentDialog) return;
    try {
      const data = await post({
        action: "delete-payment-verification",
        id: deletePaymentDialog.id,
      });
      setParticipants((current) =>
        current.map((item) =>
          item.id === deletePaymentDialog.id
            ? {
                ...item,
                paymentStatus: String(data.status),
                paymentNote: "",
                paymentVerificationSource: "",
                paymentReceivedAmount: 0,
                paymentPaidAt: null,
              }
            : item,
        ),
      );
      setDeletePaymentDialog(null);
      toast.success("Verifikasi pembayaran dihapus. Peserta tetap tersimpan.");
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Verifikasi pembayaran belum dapat dihapus.",
      );
    }
  }

  function registrationUrl() {
    return `${publicSiteOrigin}/daftar/${eventId}`;
  }
  async function copyRegistrationLink() {
    await navigator.clipboard.writeText(registrationUrl());
    toast.success("Link registrasi disalin.");
  }
  async function shareRegistration() {
    const url = registrationUrl();
    const text = `Silakan mendaftar untuk ${activeEvent?.name}: ${url}`;
    if (navigator.share)
      await navigator.share({ title: activeEvent?.name, text, url });
    else
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
  }
  async function toggleRegistration() {
    if (!activeEvent) return;
    try {
      await post({
        action: "registration",
        eventId,
        open: !activeEvent.registrationOpen,
      });
      setEvents((current) =>
        current.map((event) =>
          event.id === eventId
            ? { ...event, registrationOpen: event.registrationOpen ? 0 : 1 }
            : event,
        ),
      );
      toast.success(
        activeEvent.registrationOpen
          ? "Pendaftaran ditutup."
          : "Pendaftaran dibuka.",
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Status pendaftaran belum dapat diubah.",
      );
    }
  }

  function exportCsv() {
    const header = [
      "Nama",
      "WhatsApp",
      "Kategori",
      "TDA Passport",
      "Bisnis/Instansi",
      "Tagihan",
      "Status Pembayaran",
      "Status Kehadiran",
      "Waktu Check-in",
      "Metode",
    ];
    const csv = [
      header,
      ...rows.map((p) => [
        p.name,
        p.phone,
        p.category,
        p.passportNumber,
        p.organization,
        p.amountDue,
        p.paymentStatus,
        p.checkedInAt ? "Hadir" : "Belum hadir",
        p.checkedInAt ?? "",
        p.checkInMethod ?? "",
      ]),
    ]
      .map((line) =>
        line
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `kehadiran-${activeEvent?.eventDate || "event"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const nav: { id: Tab; label: string }[] = fastMode
    ? [
        { id: "checkin", label: "Check-in Cepat" },
        { id: "participants", label: "Daftar Peserta" },
      ]
    : [
        { id: "dashboard", label: "Dashboard" },
        { id: "participants", label: "Peserta" },
        { id: "payments", label: "Pembayaran" },
        { id: "checkin", label: "Check-in" },
        { id: "report", label: "Laporan" },
      ];
  if (loading)
    return (
      <div className="grid min-h-[55vh] place-items-center text-sm text-muted-foreground">
        Memuat data kehadiran…
      </div>
    );

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.16em] text-primary">
            {fastMode ? "Mode Operasional" : "Modul Event"}
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            {fastMode ? "Check-in Cepat" : "Kehadiran Peserta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {fastMode
              ? "Halaman ringan khusus meja registrasi. Biarkan halaman ini tetap terbuka selama acara."
              : "Registrasi, check-in, dan laporan peserta dalam satu tempat."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={eventId}
            onChange={(e) => selectEvent(Number(e.target.value))}
            className="h-11 min-w-64 rounded-xl border bg-white px-3 text-sm font-semibold"
            aria-label="Pilih event"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          {fastMode ? (
            <Link
              href="/#attendance"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold"
            >
              <ArrowLeft className="size-4" /> Kembali
            </Link>
          ) : (
            <>
              <Link
                href="/checkin"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"
              >
                <Zap className="size-4" /> Mode Check-in Cepat
              </Link>
              <button
                onClick={openNewEvent}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-muted"
              >
                <Plus className="size-4" /> Event Baru
              </button>
            </>
          )}
        </div>
      </div>
      {activeEvent && (
        <div className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{activeEvent.name}</strong>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${activeEvent.registrationOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {activeEvent.registrationOpen
                    ? "Pendaftaran dibuka"
                    : "Pendaftaran ditutup"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${activeEvent.isPaid ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700"}`}
                >
                  {activeEvent.isPaid ? "Berbayar" : "Gratis"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeEvent.eventDate} · {activeEvent.startTime || "—"}–
                {activeEvent.endTime || "—"} ·{" "}
                {activeEvent.location || "Lokasi belum diisi"}
              </p>
              {activeEvent.programTitle && (
                <p className="mt-1 text-sm font-semibold text-primary">
                  {activeEvent.programCode} · {activeEvent.programTitle}
                </p>
              )}
            </div>
            <div
              className={
                fastMode
                  ? "hidden"
                  : "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end"
              }
            >
              <button
                onClick={copyRegistrationLink}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold"
              >
                <Copy className="size-4" /> Salin Link
              </button>
              <button
                onClick={shareRegistration}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold"
              >
                <Share2 className="size-4" /> Bagikan
              </button>
              <a
                href={registrationUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold"
              >
                <ExternalLink className="size-4" /> Buka Form
              </a>
              <button
                onClick={() => openEditEvent(activeEvent)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold text-primary"
              >
                <Pencil className="size-4" /> Edit
              </button>
              <button
                onClick={() => setDeleteEventDialog(activeEvent)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300 px-3 text-sm font-semibold text-rose-700"
              >
                <Trash2 className="size-4" /> Hapus
              </button>
              <button
                onClick={toggleRegistration}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#102d20] px-3 text-sm font-semibold text-white"
              >
                <LockKeyhole className="size-4" />{" "}
                {activeEvent.registrationOpen ? "Tutup" : "Buka"}
              </button>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-800 sm:text-sm">
            tdapku.my.id/daftar/{eventId}
          </div>
        </div>
      )}
      <div
        className={`mb-5 grid gap-1 rounded-2xl bg-muted p-1 ${fastMode ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-5"}`}
      >
        {nav.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-11 rounded-xl px-2 text-xs font-semibold sm:text-sm ${tab === item.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {fastMode && (
        <div
          className={`mb-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${online ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}
        >
          <div className="flex items-center gap-3">
            {online ? (
              <Wifi className="size-5 text-emerald-700" />
            ) : (
              <WifiOff className="size-5 text-amber-700" />
            )}
            <div>
              <p className="text-sm font-bold">
                {online ? "Terhubung ke server" : "Koneksi terputus"}
              </p>
              <p className="text-xs text-muted-foreground">
                {pendingTokens.length
                  ? `${pendingTokens.length} check-in menunggu sinkronisasi.`
                  : online
                    ? "Check-in langsung tersimpan ke server."
                    : "Peserta yang sudah lunas akan masuk antrean sementara."}
              </p>
            </div>
          </div>
          {pendingTokens.length > 0 && (
            <button
              onClick={() => void syncPendingCheckIns()}
              disabled={!online || syncing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Menyinkronkan…" : "Sinkronkan Ulang"}
            </button>
          )}
        </div>
      )}
      {participantsLoading && (
        <div className="mb-4 rounded-xl border bg-white px-4 py-3 text-sm text-muted-foreground">
          Memuat peserta event…
        </div>
      )}

      {tab === "dashboard" && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Terdaftar" value={rows.length} icon={Users} />
            <Stat label="Sudah hadir" value={present.length} icon={UserCheck} />
            <Stat
              label="Menunggu verifikasi"
              value={waitingPayments.length}
              icon={Banknote}
            />
            <Stat
              label={
                activeEvent?.isPaid
                  ? "Pendapatan terverifikasi"
                  : "Tingkat kehadiran"
              }
              value={
                activeEvent?.isPaid ? money.format(verifiedRevenue) : `${rate}%`
              }
              icon={CheckCircle2}
            />
          </section>
          <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Kedatangan terbaru</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Data diperbarui setelah setiap check-in.
                </p>
              </div>
              <button
                onClick={() => setTab("checkin")}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Mulai check-in
              </button>
            </div>
            <ParticipantTable
              rows={present.slice(0, 8)}
              onCheckIn={checkIn}
              onDelete={setDeleteId}
            />
          </section>
        </>
      )}

      {tab === "participants" && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama atau WhatsApp…"
                  className="h-11 w-full rounded-xl border pl-10 pr-3 text-sm"
                />
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 rounded-xl border bg-white px-3 text-sm"
              >
                <option value="">Semua kategori</option>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setParticipantOpen(true)}
              disabled={!eventId}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="size-4" /> Tambah Peserta
            </button>
          </div>
          <ParticipantTable
            rows={filtered}
            onCheckIn={checkIn}
            onDelete={setDeleteId}
          />
        </section>
      )}

      {tab === "payments" && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="font-bold">Verifikasi pembayaran</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bukti dapat berasal dari sistem, WhatsApp, mutasi rekening, atau
              pembayaran tunai.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {rows
              .filter((participant) => participant.amountDue > 0)
              .map((participant) => (
                <article
                  key={participant.id}
                  className="rounded-2xl border p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{participant.name}</h3>
                        <PaymentBadge status={participant.paymentStatus} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {participant.category} · {participant.phone} ·{" "}
                        {participant.priceLabel}
                      </p>
                      <p className="mt-2 text-lg font-bold text-emerald-800">
                        {money.format(participant.amountDue)}
                      </p>
                      {participant.paymentStatus === "paid" && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          Ditutup via{" "}
                          {sourceLabel(participant.paymentVerificationSource)} ·
                          diterima{" "}
                          {money.format(
                            participant.paymentReceivedAmount ||
                              participant.amountDue,
                          )}
                        </p>
                      )}
                    </div>
                    {participant.paymentProofKey ? (
                      <a
                        href={`/api/attendance/payment-proof/${participant.id}`}
                        target="_blank"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold text-primary"
                      >
                        <FileText className="size-4" /> Lihat Bukti
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Bukti belum diunggah
                      </span>
                    )}
                  </div>
                  {participant.paymentStatus === "paid" && (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                      <button
                        onClick={() => openPaymentDialog(participant)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold text-primary"
                      >
                        <Pencil className="size-4" />
                        Edit Pembayaran
                      </button>
                      <button
                        onClick={() => setDeletePaymentDialog(participant)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 text-sm font-bold text-rose-700"
                      >
                        <Trash2 className="size-4" />
                        Hapus
                      </button>
                    </div>
                  )}
                  {participant.paymentStatus !== "paid" && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <input
                        value={paymentNote[participant.id] ?? ""}
                        onChange={(e) =>
                          setPaymentNote({
                            ...paymentNote,
                            [participant.id]: e.target.value,
                          })
                        }
                        placeholder="Catatan untuk peserta (opsional)"
                        className="h-10 rounded-xl border px-3 text-sm"
                      />
                      <button
                        onClick={() => openPaymentDialog(participant)}
                        className="h-10 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"
                      >
                        {participant.paymentProofKey
                          ? "Konfirmasi Lunas"
                          : "Tandai Lunas Manual"}
                      </button>
                      <button
                        disabled={!participant.paymentProofKey}
                        onClick={() => updatePayment(participant, "rejected")}
                        className="h-10 rounded-xl border border-rose-300 px-4 text-sm font-bold text-rose-700 disabled:opacity-40"
                      >
                        Tolak
                      </button>
                    </div>
                  )}
                </article>
              ))}
            {!rows.some((participant) => participant.amountDue > 0) && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Belum ada pembayaran pada event ini.
              </p>
            )}
          </div>
        </section>
      )}

      {tab === "checkin" && (
        <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <QrScanner eventId={eventId} onScanned={checkInToken} />
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold">Check-in manual</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cari peserta, lalu tekan tombol Hadir.
            </p>
            <label className="relative mt-4 block">
              <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nama atau nomor WhatsApp…"
                className="h-11 w-full rounded-xl border pl-10 pr-3 text-sm"
              />
            </label>
            <ParticipantTable
              rows={filtered.filter((p) => !p.checkedInAt)}
              onCheckIn={checkIn}
              onDelete={setDeleteId}
            />
          </div>
        </section>
      )}

      {tab === "report" && (
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold">Laporan kehadiran</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Rekap peserta berdasarkan kategori dan metode check-in.
              </p>
            </div>
            <button
              onClick={exportCsv}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Download className="size-4" /> Ekspor Excel
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {categories.map((item) => (
              <div key={item} className="rounded-xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">{item} hadir</p>
                <p className="mt-2 text-2xl font-bold">
                  {present.filter((p) => p.category === item).length}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={participantOpen} onOpenChange={setParticipantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah peserta</DialogTitle>
            <DialogDescription>
              Masukkan peserta untuk {activeEvent?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Nama lengkap">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-11 rounded-xl border px-3"
              />
            </Field>
            <Field label="Nomor WhatsApp">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-11 rounded-xl border px-3"
              />
            </Field>
            <Field label="Kategori">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-11 rounded-xl border bg-white px-3"
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Bisnis/instansi">
              <input
                value={form.organization}
                onChange={(e) =>
                  setForm({ ...form, organization: e.target.value })
                }
                className="h-11 rounded-xl border px-3"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.checkIn}
                onChange={(e) =>
                  setForm({ ...form, checkIn: e.target.checked })
                }
              />{" "}
              Langsung tandai hadir
            </label>
            <button
              onClick={addParticipant}
              className="mt-2 h-11 rounded-xl bg-primary font-semibold text-primary-foreground"
            >
              Simpan peserta
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={onsiteParticipant !== null}
        onOpenChange={(open) => !open && setOnsiteParticipant(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terima Pembayaran & Check-in</DialogTitle>
            <DialogDescription>
              {onsiteParticipant?.name} belum lunas. Pembayaran ini menunggu
              validasi Bendahara dan belum menambah saldo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Tagihan peserta
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-950">
                {money.format(onsiteParticipant?.amountDue ?? 0)}
              </p>
            </div>
            <Field label="Metode pembayaran">
              <select
                value={onsiteForm.method}
                onChange={(e) =>
                  setOnsiteForm({ ...onsiteForm, method: e.target.value })
                }
                className="h-11 rounded-xl border bg-white px-3"
              >
                <option>Tunai</option>
                <option>QRIS</option>
                <option>Transfer Bank</option>
                <option>Lainnya</option>
              </select>
            </Field>
            <Field label="Rekening/Kas penerima">
              <select
                value={onsiteForm.accountId}
                onChange={(e) =>
                  setOnsiteForm({ ...onsiteForm, accountId: e.target.value })
                }
                className="h-11 rounded-xl border bg-white px-3"
                required
              >
                <option value="">Pilih rekening atau kas</option>
                {treasuryAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nominal diterima">
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm text-muted-foreground">
                  Rp
                </span>
                <input
                  type="number"
                  min="1"
                  value={onsiteForm.receivedAmount}
                  onChange={(e) =>
                    setOnsiteForm({
                      ...onsiteForm,
                      receivedAmount: e.target.value,
                    })
                  }
                  className="h-11 w-full rounded-xl border pl-9 pr-3"
                />
              </div>
            </Field>
            <Field label="Waktu pembayaran">
              <input
                type="datetime-local"
                value={onsiteForm.paidAt}
                onChange={(e) =>
                  setOnsiteForm({ ...onsiteForm, paidAt: e.target.value })
                }
                className="h-11 rounded-xl border px-3"
              />
            </Field>
            <Field label="Bukti pembayaran (opsional)">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setOnsiteProof(e.target.files?.[0] ?? null)}
                className="rounded-xl border bg-white p-3 text-sm"
              />
            </Field>
            <Field label="Catatan (opsional)">
              <textarea
                value={onsiteForm.note}
                onChange={(e) =>
                  setOnsiteForm({ ...onsiteForm, note: e.target.value })
                }
                rows={2}
                className="rounded-xl border p-3 text-sm"
              />
            </Field>
            <button
              disabled={
                !onsiteForm.accountId ||
                Number(onsiteForm.receivedAmount) <= 0 ||
                !onsiteForm.paidAt
              }
              onClick={receiveOnsiteAndCheckIn}
              className="mt-2 h-11 rounded-xl bg-emerald-700 font-semibold text-white disabled:opacity-40"
            >
              Simpan Pembayaran & Check-in
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={paymentDialog !== null}
        onOpenChange={(open) => !open && setPaymentDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paymentDialog?.paymentStatus === "paid"
                ? "Edit verifikasi pembayaran"
                : "Tutup pembayaran sebagai lunas"}
            </DialogTitle>
            <DialogDescription>
              {paymentDialog?.paymentStatus === "paid"
                ? `Perbarui data pembayaran ${paymentDialog.name}. Perubahan nominal otomatis menyesuaikan laporan keuangan.`
                : `Catat sumber verifikasi untuk ${paymentDialog?.name ?? "peserta"}. QR check-in akan langsung diaktifkan.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Sumber verifikasi">
              <select
                value={paymentForm.source}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, source: e.target.value })
                }
                className="h-11 rounded-xl border bg-white px-3"
              >
                <option value="system_proof">Bukti di sistem</option>
                <option value="whatsapp">Bukti via WhatsApp</option>
                <option value="bank_mutation">Cek mutasi rekening</option>
                <option value="cash">Pembayaran tunai</option>
                <option value="other">Lainnya</option>
              </select>
            </Field>
            <Field label="Metode pembayaran">
              <select
                value={paymentForm.method}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, method: e.target.value })
                }
                className="h-11 rounded-xl border bg-white px-3"
              >
                <option>Transfer Bank</option>
                <option>QRIS</option>
                <option>Tunai</option>
                <option>Lainnya</option>
              </select>
            </Field>
            <Field label="Nominal diterima">
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm text-muted-foreground">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  value={paymentForm.receivedAmount}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      receivedAmount: e.target.value,
                    })
                  }
                  className="h-11 w-full rounded-xl border pl-9 pr-3"
                />
              </div>
            </Field>
            <Field label="Tanggal pembayaran">
              <input
                type="datetime-local"
                value={paymentForm.paidAt}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, paidAt: e.target.value })
                }
                className="h-11 rounded-xl border px-3"
              />
            </Field>
            <Field label="Catatan finance (opsional)">
              <textarea
                value={paymentForm.note}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, note: e.target.value })
                }
                rows={3}
                className="rounded-xl border p-3 text-sm"
                placeholder="Contoh: Bukti diterima oleh admin via WhatsApp"
              />
            </Field>
            <button
              disabled={
                !paymentDialog ||
                Number(paymentForm.receivedAmount) <= 0 ||
                !paymentForm.paidAt
              }
              onClick={() =>
                paymentDialog && updatePayment(paymentDialog, "paid")
              }
              className="mt-2 h-11 rounded-xl bg-emerald-700 font-semibold text-white disabled:opacity-40"
            >
              {paymentDialog?.paymentStatus === "paid"
                ? "Simpan Perubahan"
                : "Konfirmasi dan Aktifkan QR"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={eventOpen}
        onOpenChange={(open) => {
          setEventOpen(open);
          if (!open) setEditingEventId(null);
        }}
      >
        <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-none overflow-y-auto rounded-none sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-6xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEventId ? "Edit event" : "Buat event baru"}
            </DialogTitle>
            <DialogDescription>
              {editingEventId
                ? "Perbarui informasi event, harga, dan metode pembayarannya."
                : "Hubungkan event ke Program Kerja dan atur registrasi serta pembayaran."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Program Kerja">
              <select
                value={eventForm.programId}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    programId: e.target.value,
                    isCollaboration: e.target.value
                      ? false
                      : eventForm.isCollaboration,
                  })
                }
                className="h-11 rounded-xl border bg-white px-3"
              >
                <option value="">Tidak dihubungkan</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.programCode} · {program.title} ·{" "}
                    {program.divisionName}
                  </option>
                ))}
              </select>
            </Field>
            {!eventForm.programId && (
              <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 lg:col-span-2">
                <label className="flex items-center justify-between gap-4">
                  <span>
                    <strong className="block text-sm">Event Kolaborasi</strong>
                    <span className="text-xs text-muted-foreground">
                      Untuk kegiatan mitra/member yang berkolaborasi bersama TDA
                      Pekanbaru.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={eventForm.isCollaboration}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        isCollaboration: e.target.checked,
                      })
                    }
                    className="size-5 accent-emerald-700"
                  />
                </label>
                {eventForm.isCollaboration && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Nama penyelenggara/mitra">
                      <input
                        value={eventForm.collaborationPartner}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            collaborationPartner: e.target.value,
                          })
                        }
                        className="h-11 rounded-xl border bg-white px-3"
                        placeholder="Contoh: Little Castle Montessori School"
                      />
                    </Field>
                    <Field label="Judul publik/kolaborasi">
                      <input
                        value={eventForm.publicTitle}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            publicTitle: e.target.value,
                          })
                        }
                        className="h-11 rounded-xl border bg-white px-3"
                        placeholder="Judul yang tampil pada formulir peserta"
                      />
                    </Field>
                  </div>
                )}
                <Field
                  label={
                    editingEventId && activeEvent?.flyerKey
                      ? "Ganti flyer (opsional, maks. 5 MB)"
                      : "Upload flyer (maks. 5 MB)"
                  }
                >
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(e) => setFlyer(e.target.files?.[0] ?? null)}
                    className="rounded-xl border bg-white p-3 text-sm"
                  />
                </Field>
              </section>
            )}
            {eventForm.programId && (
              <Field label="Breakdown penerimaan peserta">
                <select
                  value={eventForm.incomeTaskId}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, incomeTaskId: e.target.value })
                  }
                  className="h-11 rounded-xl border bg-white px-3"
                >
                  <option value="">Transaksi Umum Program</option>
                  {attendanceTasks
                    .filter(
                      (task) => task.programId === Number(eventForm.programId),
                    )
                    .map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Nama event">
              <input
                value={eventForm.name}
                onChange={(e) =>
                  setEventForm({ ...eventForm, name: e.target.value })
                }
                className="h-11 rounded-xl border px-3"
                required
              />
            </Field>
            <Field label="Tanggal">
              <input
                type="date"
                value={eventForm.eventDate}
                onChange={(e) =>
                  setEventForm({ ...eventForm, eventDate: e.target.value })
                }
                className="h-11 rounded-xl border px-3"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mulai">
                <input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, startTime: e.target.value })
                  }
                  className="h-11 rounded-xl border px-3"
                />
              </Field>
              <Field label="Selesai">
                <input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, endTime: e.target.value })
                  }
                  className="h-11 rounded-xl border px-3"
                />
              </Field>
            </div>
            <Field label="Lokasi">
              <input
                value={eventForm.location}
                onChange={(e) =>
                  setEventForm({ ...eventForm, location: e.target.value })
                }
                className="h-11 rounded-xl border px-3"
              />
            </Field>
            <section className="rounded-2xl border bg-muted/20 p-4 lg:col-span-2">
              <h3 className="font-bold">Kategori peserta yang diizinkan</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Hanya kategori yang dicentang yang akan tampil pada formulir
                pendaftaran peserta.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ["allowPublicCategory", "Umum"],
                  ["allowMemberCategory", "Member TDA"],
                  ["allowCommitteeCategory", "Pengurus TDA"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex min-h-12 items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(
                        eventForm[key as keyof typeof eventForm],
                      )}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          [key]: e.target.checked,
                        })
                      }
                      className="size-5 accent-emerald-700"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>
            <label className="mt-2 flex items-center justify-between rounded-xl border p-4 lg:col-span-2">
              <span>
                <strong className="block text-sm">Event berbayar</strong>
                <span className="text-xs text-muted-foreground">
                  Aktifkan harga dan konfirmasi pembayaran.
                </span>
              </span>
              <input
                type="checkbox"
                checked={eventForm.isPaid}
                onChange={(e) => {
                  const account = treasuryAccounts[0];
                  setEventForm({
                    ...eventForm,
                    isPaid: e.target.checked,
                    treasuryAccountId:
                      e.target.checked && account
                        ? String(account.id)
                        : eventForm.treasuryAccountId,
                    bankName:
                      e.target.checked && account?.type === "bank"
                        ? account.bankName
                        : eventForm.bankName,
                    bankAccountNumber:
                      e.target.checked && account?.type === "bank"
                        ? account.accountNumber
                        : eventForm.bankAccountNumber,
                    bankAccountName:
                      e.target.checked && account?.type === "bank"
                        ? account.accountHolder
                        : eventForm.bankAccountName,
                  });
                }}
                className="size-5 accent-emerald-700"
              />
            </label>
            {eventForm.isPaid && (
              <div className="space-y-4 rounded-2xl border bg-muted/20 p-4 lg:col-span-2">
                <div>
                  <h3 className="font-bold">Harga normal</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <MoneyField
                      label="Umum"
                      value={eventForm.publicPrice}
                      onChange={(value) =>
                        setEventForm({ ...eventForm, publicPrice: value })
                      }
                    />
                    <MoneyField
                      label="Member TDA"
                      value={eventForm.memberPrice}
                      onChange={(value) =>
                        setEventForm({ ...eventForm, memberPrice: value })
                      }
                    />
                    <MoneyField
                      label="Pengurus"
                      value={eventForm.committeePrice}
                      onChange={(value) =>
                        setEventForm({ ...eventForm, committeePrice: value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold">Harga early bird</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Isi 0 jika kategori tersebut gratis saat early bird.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <MoneyField
                      label="Umum"
                      value={eventForm.earlyBirdPublicPrice}
                      onChange={(value) =>
                        setEventForm({
                          ...eventForm,
                          earlyBirdPublicPrice: value,
                        })
                      }
                    />
                    <MoneyField
                      label="Member TDA"
                      value={eventForm.earlyBirdMemberPrice}
                      onChange={(value) =>
                        setEventForm({
                          ...eventForm,
                          earlyBirdMemberPrice: value,
                        })
                      }
                    />
                    <MoneyField
                      label="Pengurus"
                      value={eventForm.earlyBirdCommitteePrice}
                      onChange={(value) =>
                        setEventForm({
                          ...eventForm,
                          earlyBirdCommitteePrice: value,
                        })
                      }
                    />
                  </div>
                  <Field label="Early bird berakhir">
                    <input
                      type="datetime-local"
                      value={eventForm.earlyBirdEndsAt}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          earlyBirdEndsAt: e.target.value,
                        })
                      }
                      className="h-11 rounded-xl border bg-white px-3"
                    />
                  </Field>
                </div>
                <div>
                  <h3 className="font-bold">Informasi pembayaran</h3>
                  <Field label="Rekening tujuan">
                    <select
                      value={eventForm.treasuryAccountId}
                      onChange={(e) => {
                        const account = treasuryAccounts.find(
                          (item) => item.id === Number(e.target.value),
                        );
                        setEventForm({
                          ...eventForm,
                          treasuryAccountId: e.target.value,
                          bankName:
                            account?.type === "bank" ? account.bankName : "",
                          bankAccountNumber:
                            account?.type === "bank"
                              ? account.accountNumber
                              : "",
                          bankAccountName:
                            account?.type === "bank"
                              ? account.accountHolder
                              : "",
                        });
                      }}
                      className="h-11 rounded-xl border bg-white px-3"
                      required
                    >
                      <option value="">Pilih rekening penerima</option>
                      {treasuryAccounts
                        .filter((account) => account.type === "bank")
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Bank">
                      <input
                        value={eventForm.bankName}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            bankName: e.target.value,
                          })
                        }
                        placeholder="Contoh: BSI"
                        className="h-11 rounded-xl border bg-white px-3"
                      />
                    </Field>
                    <Field label="Nomor rekening">
                      <input
                        value={eventForm.bankAccountNumber}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            bankAccountNumber: e.target.value,
                          })
                        }
                        className="h-11 rounded-xl border bg-white px-3"
                      />
                    </Field>
                  </div>
                  <Field label="Nama pemilik rekening">
                    <input
                      value={eventForm.bankAccountName}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          bankAccountName: e.target.value,
                        })
                      }
                      className="h-11 rounded-xl border bg-white px-3"
                    />
                  </Field>
                  <Field
                    label={
                      editingEventId && activeEvent?.qrisKey
                        ? "Ganti QRIS (opsional, maks. 5 MB)"
                        : "Upload QRIS (maks. 5 MB)"
                    }
                  >
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => setQris(e.target.files?.[0] ?? null)}
                      className="rounded-xl border bg-white p-3 text-sm"
                    />
                  </Field>
                  <Field label="Petunjuk pembayaran">
                    <textarea
                      value={eventForm.paymentInstructions}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          paymentInstructions: e.target.value,
                        })
                      }
                      rows={3}
                      className="rounded-xl border bg-white p-3 text-sm"
                      placeholder="Contoh: Cantumkan nama peserta pada berita transfer."
                    />
                  </Field>
                </div>
              </div>
            )}
            <button
              disabled={
                !eventForm.name.trim() ||
                !eventForm.eventDate ||
                (eventForm.isCollaboration &&
                  !eventForm.collaborationPartner.trim()) ||
                (eventForm.isPaid && !eventForm.treasuryAccountId)
              }
              onClick={saveEvent}
              className="mt-2 h-11 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50 lg:col-span-2"
            >
              {editingEventId ? "Simpan Perubahan" : "Buat event"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus peserta?</AlertDialogTitle>
            <AlertDialogDescription>
              Data peserta dan catatan check-in akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={removeParticipant}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deletePaymentDialog !== null}
        onOpenChange={(open) => !open && setDeletePaymentDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus verifikasi pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Status lunas {deletePaymentDialog?.name} akan dibatalkan dan
              mutasi keuangan terkait akan dikoreksi. Data peserta, kehadiran,
              dan bukti yang pernah diunggah tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={removePaymentVerification}>
              Hapus Verifikasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deleteEventDialog !== null}
        onOpenChange={(open) => !open && setDeleteEventDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus event {deleteEventDialog?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Event beserta seluruh peserta, bukti pembayaran, catatan check-in,
              dan mutasi otomatis yang terkait akan dihapus permanen. Tindakan
              ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeEvent}
              className="bg-rose-700 text-white hover:bg-rose-800"
            >
              Hapus Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-primary">
          <Icon className="size-5" />
        </span>
        <strong className="text-3xl tabular-nums">{value}</strong>
      </div>
      <p className="mt-4 text-sm font-semibold text-muted-foreground">
        {label}
      </p>
    </article>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}
function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <span className="absolute left-3 top-3 text-sm text-muted-foreground">
          Rp
        </span>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-xl border bg-white pl-9 pr-3"
        />
      </div>
    </Field>
  );
}
function sourceLabel(source: string) {
  return (
    (
      {
        system_proof: "bukti sistem",
        whatsapp: "WhatsApp",
        bank_mutation: "mutasi rekening",
        cash: "tunai",
        other: "sumber lain",
      } as Record<string, string>
    )[source] ?? "verifikasi admin"
  );
}
function PaymentBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Belum Bayar",
    verification: "Menunggu Verifikasi",
    onsite_pending: "Dibayar di Lokasi",
    paid: "Lunas Terverifikasi",
    rejected: "Perlu Ditindaklanjuti",
    not_required: "Gratis",
  };
  const colors: Record<string, string> = {
    paid: "bg-emerald-50 text-emerald-700",
    verification: "bg-amber-50 text-amber-800",
    onsite_pending: "bg-blue-50 text-blue-700",
    rejected: "bg-rose-50 text-rose-700",
    pending: "bg-slate-100 text-slate-600",
    not_required: "bg-blue-50 text-blue-700",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors[status] ?? colors.pending}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
function ParticipantTable({
  rows,
  onCheckIn,
  onDelete,
}: {
  rows: Participant[];
  onCheckIn: (participant: Participant) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="px-2 py-3 font-semibold">Peserta</th>
            <th className="px-2 py-3 font-semibold">Kategori</th>
            <th className="px-2 py-3 font-semibold">WhatsApp</th>
            <th className="px-2 py-3 font-semibold">Pembayaran</th>
            <th className="px-2 py-3 font-semibold">Kehadiran</th>
            <th className="px-2 py-3 text-right font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-2 py-3">
                <strong>{row.name}</strong>
                <p className="text-xs text-muted-foreground">
                  {row.organization || "—"}
                </p>
              </td>
              <td className="px-2 py-3">{row.category}</td>
              <td className="px-2 py-3">{row.phone}</td>
              <td className="px-2 py-3">
                <PaymentBadge status={row.paymentStatus} />
                {row.amountDue > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {money.format(row.amountDue)}
                  </p>
                )}
              </td>
              <td className="px-2 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.checkedInAt ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {row.checkedInAt
                    ? `Hadir · ${new Date(row.checkedInAt + "Z").toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`
                    : "Belum hadir"}
                </span>
              </td>
              <td className="px-2 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${publicSiteOrigin}/feedback/${row.qrToken}`,
                      );
                      toast.success("Link feedback peserta disalin.");
                    }}
                    className="rounded-lg border px-3 py-2 text-xs font-bold text-primary"
                  >
                    Feedback
                  </button>
                  {!row.checkedInAt && (
                    <button
                      onClick={() => onCheckIn(row)}
                      className="rounded-lg border border-primary px-3 py-2 text-xs font-bold text-primary"
                    >
                      {row.amountDue > 0 &&
                      row.paymentStatus !== "paid" &&
                      row.paymentStatus !== "not_required"
                        ? "Bayar & Hadir"
                        : "Hadir"}
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(row.id)}
                    className="grid size-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"
                    aria-label={`Hapus ${row.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                colSpan={6}
                className="py-10 text-center text-muted-foreground"
              >
                Belum ada peserta pada tampilan ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function QrScanner({
  eventId,
  onScanned,
}: {
  eventId: number;
  onScanned: (token: string) => Promise<ScanOutcome>;
}) {
  const readerId = `qr-reader-${useId().replaceAll(":", "")}`;
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  const usbInputRef = useRef<HTMLInputElement>(null);
  const processing = useRef(false);
  const [mode, setMode] = useState<"camera" | "usb">("camera");
  const [active, setActive] = useState(false);
  const [usbValue, setUsbValue] = useState("");
  const [message, setMessage] = useState(
    "Tekan tombol untuk mengaktifkan kamera belakang.",
  );
  const [result, setResult] = useState<{
    type: "success" | "pending" | "error";
    title: string;
    detail: string;
  } | null>(null);
  async function stop() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
      } catch {}
      scanner.clear();
    }
    setActive(false);
  }
  async function processToken(raw: string, source: "camera" | "usb") {
    const token = raw.trim();
    if (!token || processing.current) return;
    processing.current = true;
    try {
      const outcome = await onScanned(token);
      setResult(
        outcome.pending
          ? {
              type: "pending",
              title: "Tersimpan Sementara",
              detail: `${outcome.name} menunggu sinkronisasi ke server.`,
            }
          : {
              type: "success",
              title: "Tersimpan di Server",
              detail: `${outcome.name} sudah tercatat hadir.`,
            },
      );
      setMessage(
        outcome.pending
          ? "Lanjutkan scan. Sistem akan menyinkronkan otomatis saat koneksi kembali."
          : source === "usb"
            ? "Berhasil. Scanner siap untuk peserta berikutnya."
            : "Kamera siap untuk peserta berikutnya.",
      );
      if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
      window.setTimeout(() => setResult(null), 3500);
    } catch (reason) {
      const detail =
        reason instanceof Error ? reason.message : "QR belum dapat diproses.";
      setResult({ type: "error", title: "Check-in Gagal", detail });
      setMessage(
        source === "usb"
          ? "Scan ulang atau gunakan check-in manual."
          : "Coba pindai ulang atau gunakan check-in manual.",
      );
      if (navigator.vibrate) navigator.vibrate(500);
      window.setTimeout(() => setResult(null), 4500);
    } finally {
      if (source === "usb") {
        setUsbValue("");
        window.setTimeout(() => usbInputRef.current?.focus(), 0);
      }
      window.setTimeout(() => {
        processing.current = false;
      }, 300);
    }
  }
  async function useUsbScanner() {
    await stop();
    setMode("usb");
    setResult(null);
    setUsbValue("");
    setMessage(
      "Klik kolom sekali, lalu scan QR peserta. Scanner akan memproses setelah tombol Enter terkirim.",
    );
    window.setTimeout(() => usbInputRef.current?.focus(), 0);
  }
  async function start() {
    try {
      setMode("camera");
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      setActive(true);
      setMessage("Arahkan QR peserta ke dalam kamera.");
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (text) => void processToken(text, "camera"),
        () => undefined,
      );
    } catch {
      setActive(false);
      setMessage(
        "Kamera tidak dapat dibuka. Pastikan izin kamera diberikan dan gunakan HTTPS.",
      );
    }
  }
  useEffect(
    () => () => {
      void stop();
    },
    [],
  );
  useEffect(() => {
    processing.current = false;
  }, [eventId]);
  return (
    <div className="overflow-hidden rounded-2xl bg-[#102d20] p-5 text-center text-white shadow-sm">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1">
        <button
          onClick={() => {
            setMode("camera");
            setMessage("Tekan tombol untuk mengaktifkan kamera belakang.");
          }}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold ${mode === "camera" ? "bg-white text-emerald-900" : "text-emerald-100"}`}
        >
          <Camera className="size-4" />
          Kamera
        </button>
        <button
          onClick={useUsbScanner}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold ${mode === "usb" ? "bg-white text-emerald-900" : "text-emerald-100"}`}
        >
          <Keyboard className="size-4" />
          Scanner USB
        </button>
      </div>
      <div
        id={readerId}
        className={`overflow-hidden rounded-2xl bg-black ${mode === "camera" && active ? "min-h-64" : "hidden"}`}
      />
      {mode === "camera" && !active && (
        <div className="grid min-h-56 place-items-center">
          <div>
            <div className="mx-auto grid size-28 place-items-center rounded-3xl border-4 border-emerald-400">
              <QrCode className="size-12" />
            </div>
            <h2 className="mt-5 text-xl font-bold">Scan QR peserta</h2>
          </div>
        </div>
      )}
      {mode === "usb" && (
        <div className="grid min-h-56 content-center gap-4">
          <div className="mx-auto grid size-24 place-items-center rounded-3xl border-4 border-emerald-400">
            <Keyboard className="size-10" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Scanner USB siap</h2>
            <p className="mt-1 text-sm text-emerald-100">
              Pastikan scanner QR/2D mengirim Enter setelah membaca kode.
            </p>
          </div>
          <div className="mx-auto flex w-full max-w-md gap-2">
            <input
              ref={usbInputRef}
              autoFocus
              value={usbValue}
              onChange={(event) => setUsbValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void processToken(usbValue, "usb");
                }
              }}
              placeholder="Klik di sini lalu scan QR…"
              aria-label="Hasil scanner QR USB"
              className="h-12 min-w-0 flex-1 rounded-xl border-2 border-emerald-300 bg-white px-4 text-base font-semibold text-emerald-950 outline-none focus:ring-4 focus:ring-emerald-300/40"
            />
            <button
              onClick={() => void processToken(usbValue, "usb")}
              disabled={!usbValue.trim()}
              className="h-12 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              Proses
            </button>
          </div>
        </div>
      )}
      {result && (
        <div
          role="alert"
          aria-live="assertive"
          className={`mt-4 rounded-2xl border-2 p-5 text-left shadow-lg ${result.type === "success" ? "border-emerald-300 bg-emerald-500 text-white" : result.type === "pending" ? "border-amber-300 bg-amber-500 text-white" : "border-rose-300 bg-rose-600 text-white"}`}
        >
          <div className="flex items-start gap-3">
            {result.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-7 shrink-0" />
            ) : result.type === "pending" ? (
              <RefreshCw className="mt-0.5 size-7 shrink-0" />
            ) : (
              <UserX className="mt-0.5 size-7 shrink-0" />
            )}
            <div>
              <p className="text-lg font-bold">{result.title}</p>
              <p className="mt-1 text-sm font-semibold">{result.detail}</p>
            </div>
          </div>
        </div>
      )}
      <p className="mt-4 min-h-10 text-sm text-emerald-100" aria-live="polite">
        {message}
      </p>
      {mode === "camera" && (
        <button
          onClick={active ? stop : start}
          className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white"
        >
          {active ? (
            <CameraOff className="size-5" />
          ) : (
            <Camera className="size-5" />
          )}
          {active ? "Matikan Kamera" : "Aktifkan Kamera"}
        </button>
      )}
    </div>
  );
}
