import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const divisions = sqliteTable("divisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const periods = sqliteTable("periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").unique(),
    role: text("role").notNull().default("viewer"),
    divisionId: integer("division_id").references(() => divisions.id),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_users_division_id").on(table.divisionId)],
);

export const treasuryAccounts = sqliteTable("treasury_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("bank"),
  bankName: text("bank_name").notNull().default(""),
  accountNumber: text("account_number").notNull().default(""),
  accountHolder: text("account_holder").notNull().default(""),
  openingBalance: integer("opening_balance").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const treasuryCategories = sqliteTable("treasury_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const programs = sqliteTable(
  "programs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programCode: text("program_code").notNull().unique(),
    periodId: integer("period_id")
      .notNull()
      .references(() => periods.id),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id),
    ownerUserId: integer("owner_user_id").references(() => users.id),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    pic: text("pic").notNull().default(""),
    startDate: text("start_date").notNull().default(""),
    endDate: text("end_date").notNull().default(""),
    target: text("target").notNull().default(""),
    budget: integer("budget").notNull().default(0),
    incomeBudget: integer("income_budget").notNull().default(0),
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_programs_period_status").on(table.periodId, table.status),
    index("idx_programs_division_id").on(table.divisionId),
    index("idx_programs_end_date").on(table.endDate),
  ],
);

export const programPublications = sqliteTable(
  "program_publications",
  {
    programId: integer("program_id")
      .primaryKey()
      .references(() => programs.id, { onDelete: "cascade" }),
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(false),
    publicTitle: text("public_title").notNull().default(""),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    benefits: text("benefits").notNull().default(""),
    audience: text("audience").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    registrationEventId: integer("registration_event_id"),
    isFeatured: integer("is_featured", { mode: "boolean" })
      .notNull()
      .default(false),
    flyerKey: text("flyer_key"),
    flyerName: text("flyer_name"),
    flyerType: text("flyer_type"),
    updatedByUserId: integer("updated_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_program_publications_published_featured").on(
      table.isPublished,
      table.isFeatured,
    ),
    index("idx_program_publications_registration_event").on(
      table.registrationEventId,
    ),
  ],
);

export const publicMedia = sqliteTable(
  "public_media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaType: text("media_type").notNull().default("banner"),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    eventDate: text("event_date").notNull().default(""),
    linkUrl: text("link_url").notNull().default(""),
    imageKey: text("image_key").notNull(),
    imageName: text("image_name").notNull().default(""),
    imageType: text("image_type").notNull().default("image/webp"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_public_media_type_active_order").on(
      table.mediaType,
      table.isActive,
      table.sortOrder,
    ),
  ],
);

export const programTasks = sqliteTable(
  "program_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    title: text("title").notNull(),
    pic: text("pic").notNull().default(""),
    dueDate: text("due_date").notNull().default(""),
    status: text("status").notNull().default("belum_mulai"),
    notes: text("notes").notNull().default(""),
    usesBudget: integer("uses_budget", { mode: "boolean" })
      .notNull()
      .default(false),
    budgetAmount: integer("budget_amount").notNull().default(0),
    incomeTarget: integer("income_target").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_program_tasks_program_status").on(table.programId, table.status),
    index("idx_program_tasks_due_date").on(table.dueDate),
  ],
);

export const programTaskDivisions = sqliteTable(
  "program_task_divisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => programTasks.id),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_program_task_divisions_unique").on(
      table.taskId,
      table.divisionId,
    ),
    index("idx_program_task_divisions_division").on(
      table.divisionId,
      table.taskId,
    ),
  ],
);

export const programEvaluations = sqliteTable(
  "program_evaluations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    indicator: text("indicator").notNull(),
    targetValue: real("target_value").notNull(),
    actualValue: real("actual_value").notNull().default(0),
    unit: text("unit").notNull().default(""),
    isMeasured: integer("is_measured", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes").notNull().default(""),
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_program_evaluations_program_id").on(table.programId)],
);

export const programExpenses = sqliteTable(
  "program_expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    taskId: integer("task_id").references(() => programTasks.id),
    description: text("description").notNull(),
    category: text("category").notNull().default("Lainnya"),
    expenseDate: text("expense_date").notNull(),
    amount: integer("amount").notNull().default(0),
    treasuryAccountId: integer("treasury_account_id").references(
      () => treasuryAccounts.id,
    ),
    receiptKey: text("receipt_key"),
    receiptName: text("receipt_name"),
    receiptType: text("receipt_type"),
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_program_expenses_program_date").on(
      table.programId,
      table.expenseDate,
    ),
    index("idx_program_expenses_task_id").on(table.taskId),
    index("idx_program_expenses_treasury_account").on(table.treasuryAccountId),
  ],
);

export const programIncomes = sqliteTable(
  "program_incomes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    taskId: integer("task_id").references(() => programTasks.id),
    description: text("description").notNull(),
    source: text("source").notNull().default("Lainnya"),
    incomeDate: text("income_date").notNull(),
    amount: integer("amount").notNull().default(0),
    treasuryAccountId: integer("treasury_account_id").references(
      () => treasuryAccounts.id,
    ),
    attendanceParticipantId: integer("attendance_participant_id"),
    receiptKey: text("receipt_key"),
    receiptName: text("receipt_name"),
    receiptType: text("receipt_type"),
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_program_incomes_program_date").on(
      table.programId,
      table.incomeDate,
    ),
    index("idx_program_incomes_task_id").on(table.taskId),
    index("idx_program_incomes_treasury_account").on(table.treasuryAccountId),
    index("idx_program_incomes_attendance_participant").on(
      table.attendanceParticipantId,
    ),
  ],
);

export const treasuryTransactions = sqliteTable(
  "treasury_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => treasuryAccounts.id),
    direction: text("direction").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("Lainnya"),
    transactionDate: text("transaction_date").notNull(),
    amount: integer("amount").notNull(),
    transferGroup: text("transfer_group"),
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_treasury_transactions_account_date").on(
      table.accountId,
      table.transactionDate,
    ),
    index("idx_treasury_transactions_transfer_group").on(table.transferGroup),
  ],
);

export const programLpj = sqliteTable(
  "program_lpj",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .unique()
      .references(() => programs.id),
    status: text("status").notNull().default("belum_dibuat"),
    summary: text("summary").notNull().default(""),
    result: text("result").notNull().default(""),
    evaluation: text("evaluation").notNull().default(""),
    submittedAt: text("submitted_at"),
    completedAt: text("completed_at"),
    updatedByUserId: integer("updated_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_program_lpj_status").on(table.status)],
);

export const programApprovals = sqliteTable(
  "program_approvals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    approverUserId: integer("approver_user_id").references(() => users.id),
    status: text("status").notNull().default("pending"),
    note: text("note").notNull().default(""),
    sequence: integer("sequence").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_program_approvals_program_id").on(table.programId)],
);

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    description: text("description").notNull().default(""),
    metadata: text("metadata"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_activity_logs_entity").on(table.entityType, table.entityId),
    index("idx_activity_logs_created_at").on(table.createdAt),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    programId: integer("program_id").references(() => programs.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull().default(""),
    dedupeKey: text("dedupe_key").notNull().unique(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_notifications_user_read").on(
      table.userId,
      table.isRead,
      table.createdAt,
    ),
    index("idx_notifications_program_id").on(table.programId),
  ],
);

export const notificationRuns = sqliteTable(
  "notification_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    runDate: text("run_date").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_notification_runs_user_date").on(
      table.userId,
      table.runDate,
    ),
  ],
);

export const attendanceEvents = sqliteTable(
  "attendance_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id").references(() => programs.id),
    incomeTaskId: integer("income_task_id").references(() => programTasks.id),
    name: text("name").notNull(),
    publicTitle: text("public_title").notNull().default(""),
    collaborationPartner: text("collaboration_partner").notNull().default(""),
    isCollaboration: integer("is_collaboration", { mode: "boolean" })
      .notNull()
      .default(false),
    flyerKey: text("flyer_key"),
    flyerName: text("flyer_name"),
    flyerType: text("flyer_type"),
    eventDate: text("event_date").notNull(),
    startTime: text("start_time").notNull().default(""),
    endTime: text("end_time").notNull().default(""),
    location: text("location").notNull().default(""),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    registrationOpen: integer("registration_open", { mode: "boolean" })
      .notNull()
      .default(true),
    feedbackOpen: integer("feedback_open", { mode: "boolean" })
      .notNull()
      .default(false),
    isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
    treasuryAccountId: integer("treasury_account_id").references(
      () => treasuryAccounts.id,
    ),
    publicPrice: integer("public_price").notNull().default(0),
    memberPrice: integer("member_price").notNull().default(0),
    committeePrice: integer("committee_price").notNull().default(0),
    allowPublicCategory: integer("allow_public_category", { mode: "boolean" })
      .notNull()
      .default(true),
    allowMemberCategory: integer("allow_member_category", { mode: "boolean" })
      .notNull()
      .default(true),
    allowCommitteeCategory: integer("allow_committee_category", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    earlyBirdPublicPrice: integer("early_bird_public_price")
      .notNull()
      .default(0),
    earlyBirdMemberPrice: integer("early_bird_member_price")
      .notNull()
      .default(0),
    earlyBirdCommitteePrice: integer("early_bird_committee_price")
      .notNull()
      .default(0),
    earlyBirdEndsAt: text("early_bird_ends_at").notNull().default(""),
    bankName: text("bank_name").notNull().default(""),
    bankAccountNumber: text("bank_account_number").notNull().default(""),
    bankAccountName: text("bank_account_name").notNull().default(""),
    paymentInstructions: text("payment_instructions").notNull().default(""),
    qrisKey: text("qris_key"),
    qrisName: text("qris_name"),
    qrisType: text("qris_type"),
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_attendance_events_date").on(table.eventDate),
    index("idx_attendance_events_program_id").on(table.programId),
    index("idx_attendance_events_treasury_account").on(table.treasuryAccountId),
  ],
);

export const attendanceParticipants = sqliteTable(
  "attendance_participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => attendanceEvents.id),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    category: text("category").notNull().default("Member"),
    organization: text("organization").notNull().default(""),
    passportNumber: text("passport_number").notNull().default(""),
    amountDue: integer("amount_due").notNull().default(0),
    priceLabel: text("price_label").notNull().default("Gratis"),
    paymentStatus: text("payment_status").notNull().default("not_required"),
    paymentMethod: text("payment_method").notNull().default(""),
    paymentProofKey: text("payment_proof_key"),
    paymentProofName: text("payment_proof_name"),
    paymentProofType: text("payment_proof_type"),
    paymentConfirmedAt: text("payment_confirmed_at"),
    paymentVerifiedAt: text("payment_verified_at"),
    paymentVerifiedByUserId: integer("payment_verified_by_user_id").references(
      () => users.id,
    ),
    paymentVerificationSource: text("payment_verification_source")
      .notNull()
      .default(""),
    paymentReceivedAmount: integer("payment_received_amount")
      .notNull()
      .default(0),
    paymentPaidAt: text("payment_paid_at"),
    paymentTreasuryAccountId: integer("payment_treasury_account_id").references(
      () => treasuryAccounts.id,
    ),
    paymentReceivedByUserId: integer("payment_received_by_user_id").references(
      () => users.id,
    ),
    paymentReceivedAt: text("payment_received_at"),
    paymentNote: text("payment_note").notNull().default(""),
    qrToken: text("qr_token").notNull().unique(),
    checkedInAt: text("checked_in_at"),
    checkInMethod: text("check_in_method"),
    checkedInByUserId: integer("checked_in_by_user_id").references(
      () => users.id,
    ),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_attendance_participants_event_status").on(
      table.eventId,
      table.checkedInAt,
    ),
    index("idx_attendance_participants_event_name").on(
      table.eventId,
      table.name,
    ),
    index("idx_attendance_participants_event_payment").on(
      table.eventId,
      table.paymentStatus,
    ),
    index("idx_attendance_participants_payment_status").on(table.paymentStatus),
    uniqueIndex("idx_attendance_participants_event_phone").on(
      table.eventId,
      table.phone,
    ),
  ],
);

export const membershipOptions = sqliteTable(
  "membership_options",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_membership_options_type_label").on(
      table.type,
      table.label,
    ),
    index("idx_membership_options_type_active").on(
      table.type,
      table.isActive,
      table.sortOrder,
    ),
  ],
);

export const membershipSettings = sqliteTable("membership_settings", {
  id: integer("id").primaryKey(),
  adminWhatsapp: text("admin_whatsapp").notNull().default("6285121804468"),
  treasuryAccountId: integer("treasury_account_id").references(
    () => treasuryAccounts.id,
  ),
  qrisKey: text("qris_key"),
  qrisName: text("qris_name"),
  qrisType: text("qris_type"),
  paymentInstructions: text("payment_instructions").notNull().default(""),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const programFeedbackQuestions = sqliteTable(
  "program_feedback_questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    question: text("question").notNull(),
    questionType: text("question_type").notNull().default("paragraph"),
    optionsJson: text("options_json").notNull().default("[]"),
    isRequired: integer("is_required", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_program_feedback_questions_program").on(
      table.programId,
      table.sortOrder,
    ),
  ],
);

export const programFeedbackSubmissions = sqliteTable(
  "program_feedback_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id),
    eventId: integer("event_id")
      .notNull()
      .references(() => attendanceEvents.id),
    participantId: integer("participant_id")
      .notNull()
      .references(() => attendanceParticipants.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_program_feedback_submissions_participant").on(
      table.participantId,
    ),
    index("idx_program_feedback_submissions_program").on(table.programId),
  ],
);

export const programFeedbackAnswers = sqliteTable(
  "program_feedback_answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => programFeedbackSubmissions.id),
    questionId: integer("question_id")
      .notNull()
      .references(() => programFeedbackQuestions.id),
    answerJson: text("answer_json").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_program_feedback_answers_submission_question").on(
      table.submissionId,
      table.questionId,
    ),
  ],
);

export const membershipPackages = sqliteTable(
  "membership_packages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    registrationType: text("registration_type").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    amount: integer("amount").notNull().default(0),
    includesShirt: integer("includes_shirt", { mode: "boolean" })
      .notNull()
      .default(false),
    includesClass: integer("includes_class", { mode: "boolean" })
      .notNull()
      .default(false),
    isRecommended: integer("is_recommended", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_membership_packages_type_code").on(
      table.registrationType,
      table.code,
    ),
    index("idx_membership_packages_type_active").on(
      table.registrationType,
      table.isActive,
      table.sortOrder,
    ),
  ],
);

export const membershipRegistrations = sqliteTable(
  "membership_registrations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    registrationCode: text("registration_code").notNull().unique(),
    registrationType: text("registration_type").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    whatsapp: text("whatsapp").notNull(),
    passportNumber: text("passport_number").notNull().default(""),
    businessName: text("business_name").notNull().default(""),
    businessField: text("business_field").notNull(),
    businessAge: text("business_age").notNull(),
    employeeCount: integer("employee_count").notNull().default(0),
    annualRevenue: text("annual_revenue").notNull(),
    previousTraining: text("previous_training").notNull().default(""),
    businessIssues: text("business_issues").notNull().default("[]"),
    existingSystems: text("existing_systems").notNull().default("[]"),
    tdaGoal: text("tda_goal").notNull().default(""),
    informationSource: text("information_source").notNull().default(""),
    packageCode: text("package_code").notNull(),
    packageName: text("package_name").notNull(),
    amountDue: integer("amount_due").notNull(),
    includesShirt: integer("includes_shirt", { mode: "boolean" })
      .notNull()
      .default(false),
    shirtSize: text("shirt_size").notNull().default(""),
    sleeveType: text("sleeve_type").notNull().default(""),
    treasuryAccountId: integer("treasury_account_id").references(
      () => treasuryAccounts.id,
    ),
    paymentMethod: text("payment_method").notNull().default(""),
    paymentStatus: text("payment_status").notNull().default("pending"),
    paymentProofKey: text("payment_proof_key"),
    paymentProofName: text("payment_proof_name"),
    paymentProofType: text("payment_proof_type"),
    paymentConfirmedAt: text("payment_confirmed_at"),
    paymentVerifiedAt: text("payment_verified_at"),
    paymentVerifiedByUserId: integer("payment_verified_by_user_id").references(
      () => users.id,
    ),
    paymentReceivedAmount: integer("payment_received_amount")
      .notNull()
      .default(0),
    paymentPaidAt: text("payment_paid_at"),
    paymentNote: text("payment_note").notNull().default(""),
    memberStatus: text("member_status")
      .notNull()
      .default("menunggu_pembayaran"),
    shirtStatus: text("shirt_status").notNull().default("belum_diproses"),
    confirmationToken: text("confirmation_token").notNull().unique(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_membership_registrations_status").on(
      table.paymentStatus,
      table.createdAt,
    ),
    index("idx_membership_registrations_whatsapp").on(table.whatsapp),
    index("idx_membership_registrations_type").on(table.registrationType),
    index("idx_membership_registrations_treasury").on(table.treasuryAccountId),
  ],
);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  title: text("title").notNull(),
  pic: text("pic").notNull().default(""),
  dueDate: text("due_date").notNull(),
  priority: text("priority").notNull().default("Sedang"),
  status: text("status").notNull().default("Belum Mulai"),
  notes: text("notes").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const pics = sqliteTable("pics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id").references(() => tasks.id),
  taskTitle: text("task_title").notNull().default(""),
  action: text("action").notNull(),
  description: text("description").notNull(),
  actor: text("actor").notNull().default("Panitia"),
  oldData: text("old_data"),
  newData: text("new_data"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  undoneAt: text("undone_at"),
});
