import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const { searchParams } = req.nextUrl;
    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 50);
    const level = searchParams.get("level") ?? undefined;
    const where: any = {};
    if (level) where.level = level;
    const [total, logs] = await Promise.all([
      prisma.log.count({ where }),
      prisma.log.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    ]);
    return ok({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleError(err);
  }
}

const logSchema = z.object({ level: z.string(), message: z.string(), context: z.any().optional() });

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const body = await req.json();
    const parsed = logSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return created(await prisma.log.create({ data: { id: uuidv4(), ...parsed.data } }));
  } catch (err) {
    return handleError(err);
  }
}
