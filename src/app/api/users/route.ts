import { NextRequest } from "next/server";
import { z } from "zod";
import { listUsers, createAdminUser } from "@/lib/services/user.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const { searchParams } = req.nextUrl;
    return ok(await listUsers(
      Number(searchParams.get("page") ?? 1),
      Number(searchParams.get("limit") ?? 20),
      searchParams.get("search") ?? undefined,
    ));
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "SUPERADMIN");
    if (!session) return response;
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return created(await createAdminUser(parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
