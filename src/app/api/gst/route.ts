import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    return ok(await prisma.gst.findMany({ where: { isActive: true }, orderBy: { rate: "asc" } }));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({ name: z.string().min(1), rate: z.number().min(0) });

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return created(await prisma.gst.create({ data: { id: uuidv4(), ...parsed.data } }));
  } catch (err) {
    return handleError(err);
  }
}
