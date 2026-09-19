import { env } from "cloudflare:workers";
import type { UserRole } from "@/lib/access-types";

export const USER_ROLES: UserRole[] = ["ketua_ksb", "bendahara", "kadiv", "viewer"];

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  divisionId: number | null;
  divisionName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManagedUserInput = Pick<ManagedUser, "name" | "email" | "role" | "divisionId" | "isActive">;

function getD1() {
  if (!env.DB) throw new Error("Database belum tersedia");
  return env.DB;
}

const selectUsers = `SELECT u.id, u.name, u.email, u.role, u.division_id AS divisionId,
  d.name AS divisionName, u.is_active AS isActive, u.created_at AS createdAt,
  u.updated_at AS updatedAt FROM users u LEFT JOIN divisions d ON d.id = u.division_id`;

export async function listUsers() {
  const result = await getD1().prepare(`${selectUsers}
    ORDER BY u.is_active DESC, CASE u.role WHEN 'ketua_ksb' THEN 1 WHEN 'bendahara' THEN 2 WHEN 'kadiv' THEN 3 ELSE 4 END,
    u.name COLLATE NOCASE`).all<ManagedUser>();
  return result.results.map((user) => ({ ...user, isActive: Boolean(user.isActive) }));
}

export async function getUser(id: number) {
  const user = await getD1().prepare(`${selectUsers} WHERE u.id = ? LIMIT 1`).bind(id).first<ManagedUser>();
  return user ? { ...user, isActive: Boolean(user.isActive) } : null;
}

export async function createUser(input: ManagedUserInput) {
  const result = await getD1().prepare(`INSERT INTO users
    (name, email, role, division_id, is_active, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(input.name, input.email, input.role, input.divisionId, input.isActive ? 1 : 0).run();
  return getUser(Number(result.meta.last_row_id));
}

export async function updateUser(id: number, input: ManagedUserInput) {
  const result = await getD1().prepare(`UPDATE users SET name = ?, email = ?, role = ?,
    division_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(input.name, input.email, input.role, input.divisionId, input.isActive ? 1 : 0, id).run();
  if (!result.meta.changes) return null;
  return getUser(id);
}

export async function deactivateUser(id: number) {
  const result = await getD1().prepare(`UPDATE users SET is_active = 0,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  return Boolean(result.meta.changes);
}
