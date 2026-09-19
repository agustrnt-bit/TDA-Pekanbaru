import { env } from "cloudflare:workers";

export type ProgramEvaluationInput = {
  indicator: string;
  targetValue: number;
  actualValue: number;
  unit: string;
  isMeasured: boolean;
  notes: string;
};

export type ProgramEvaluationRecord = ProgramEvaluationInput & {
  id: number;
  programId: number;
  progress: number;
  status: "belum_diukur" | "belum_tercapai" | "sebagian" | "tercapai";
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

function db() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

const evaluationSelect = `SELECT e.id, e.program_id AS programId, e.indicator,
  e.target_value AS targetValue, e.actual_value AS actualValue, e.unit,
  e.is_measured AS isMeasured, e.notes,
  CASE WHEN e.is_measured = 0 THEN 0
    ELSE MIN(100, ROUND(100.0 * e.actual_value / e.target_value)) END AS progress,
  CASE WHEN e.is_measured = 0 THEN 'belum_diukur'
    WHEN e.actual_value >= e.target_value THEN 'tercapai'
    WHEN e.actual_value > 0 THEN 'sebagian'
    ELSE 'belum_tercapai' END AS status,
  COALESCE(u.name, 'Sistem') AS createdByName,
  e.created_at AS createdAt, e.updated_at AS updatedAt
  FROM program_evaluations e LEFT JOIN users u ON u.id = e.created_by_user_id`;

export async function listProgramEvaluations(programId: number) {
  const result = await db().prepare(`${evaluationSelect} WHERE e.program_id = ? ORDER BY e.id`)
    .bind(programId).all<ProgramEvaluationRecord>();
  return result.results.map(normalizeEvaluation);
}

export async function getProgramEvaluation(id: number, programId: number) {
  const row = await db().prepare(`${evaluationSelect} WHERE e.id = ? AND e.program_id = ? LIMIT 1`)
    .bind(id, programId).first<ProgramEvaluationRecord>();
  return row ? normalizeEvaluation(row) : null;
}

function normalizeEvaluation(row: ProgramEvaluationRecord): ProgramEvaluationRecord {
  return {
    ...row,
    targetValue: Number(row.targetValue),
    actualValue: Number(row.actualValue),
    isMeasured: Boolean(row.isMeasured),
    progress: Number(row.progress),
  };
}

export async function createProgramEvaluation(programId: number, userId: number, input: ProgramEvaluationInput) {
  const database = db();
  const result = await database.prepare(`INSERT INTO program_evaluations
    (program_id, indicator, target_value, actual_value, unit, is_measured, notes, created_by_user_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(programId, input.indicator, input.targetValue, input.actualValue, input.unit,
      input.isMeasured ? 1 : 0, input.notes, userId).run();
  await database.prepare(`UPDATE programs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(programId).run();
  return getProgramEvaluation(Number(result.meta.last_row_id), programId);
}

export async function updateProgramEvaluation(id: number, programId: number, input: ProgramEvaluationInput) {
  const database = db();
  const result = await database.prepare(`UPDATE program_evaluations SET indicator = ?, target_value = ?,
    actual_value = ?, unit = ?, is_measured = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND program_id = ?`)
    .bind(input.indicator, input.targetValue, input.actualValue, input.unit,
      input.isMeasured ? 1 : 0, input.notes, id, programId).run();
  if (!result.meta.changes) return null;
  await database.prepare(`UPDATE programs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(programId).run();
  return getProgramEvaluation(id, programId);
}

export async function deleteProgramEvaluation(id: number, programId: number) {
  const database = db();
  const result = await database.prepare(`DELETE FROM program_evaluations WHERE id = ? AND program_id = ?`)
    .bind(id, programId).run();
  if (!result.meta.changes) return false;
  await database.prepare(`UPDATE programs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(programId).run();
  return true;
}
