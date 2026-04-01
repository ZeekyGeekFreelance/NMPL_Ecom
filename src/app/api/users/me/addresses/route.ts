import { NextRequest } from "next/server";
import { z } from "zod";
import { getAddresses, createAddress } from "@/lib/services/user.service";
import { requireAuth } from "@/lib/auth/guard";
import { ok, created, handleError, validationError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    return ok(await getAddresses(session.sub));
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  fullName: z.string().min(1),
  phoneNumber: z.string().min(10),
  line1: z.string().min(1),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().default("India"),
  pincode: z.string().min(6),
  type: z.enum(["HOME", "OFFICE", "WAREHOUSE", "OTHER"]).optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAuth(req);
    if (!session) return response;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return created(await createAddress(session.sub, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}
