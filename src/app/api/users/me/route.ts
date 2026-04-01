import { NextRequest } from "next/server";
import { z } from "zod";
import { getUserById, updateUser } from "@/lib/services/user.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, handleError, validationError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    return ok(await getUserById(session.sub));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
});

export async function PUT(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return ok(await updateUser(session.sub, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
