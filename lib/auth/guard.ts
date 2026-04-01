import { NextRequest } from "next/server";
import { getSessionFromRequest } from "./session";
import { unauthorized, forbidden } from "@/lib/api";

type Role = "USER" | "ADMIN" | "SUPERADMIN" | "DEALER";

const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  DEALER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

export async function requireAuth(req: NextRequest, minRole?: Role) {
  const session = await getSessionFromRequest(req);
  if (!session) return { session: null, response: unauthorized() };

  if (minRole && (ROLE_RANK[session.role as Role] ?? -1) < ROLE_RANK[minRole]) {
    return { session: null, response: forbidden() };
  }

  return { session, response: null };
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}
