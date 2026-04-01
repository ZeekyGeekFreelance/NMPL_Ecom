import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const [pincodeRates, stateRates] = await Promise.all([
      prisma.deliveryRate.findMany({ orderBy: { pincode: "asc" } }),
      prisma.deliveryStateRate.findMany({ orderBy: { state: "asc" } }),
    ]);
    return ok({ pincodeRates, stateRates });
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  pincode: z.string().min(6).max(10),
  city: z.string().optional(),
  state: z.string().optional(),
  charge: z.number().min(0),
});

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req, "ADMIN");
    if (!session) return response;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const rate = await prisma.deliveryRate.upsert({
      where: { pincode: parsed.data.pincode },
      update: { charge: parsed.data.charge, city: parsed.data.city, state: parsed.data.state },
      create: { id: uuidv4(), ...parsed.data },
    });
    return created(rate);
  } catch (err) {
    return handleError(err);
  }
}
