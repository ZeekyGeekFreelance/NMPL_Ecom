import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    return ok(await prisma.attribute.findMany({
      include: { values: true, _count: { select: { variantAttributes: true } } },
      orderBy: { name: "asc" },
    }));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  name: z.string().min(1),
  values: z.array(z.object({ value: z.string().min(1) })).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const attr = await prisma.attribute.create({
      data: {
        id: uuidv4(),
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        values: parsed.data.values?.length
          ? { create: parsed.data.values.map((v) => ({ id: uuidv4(), value: v.value, slug: slugify(v.value) })) }
          : undefined,
      },
      include: { values: true },
    });
    return created(attr);
  } catch (err) {
    return handleError(err);
  }
}
