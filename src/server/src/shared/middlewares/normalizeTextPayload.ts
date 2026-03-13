import { NextFunction, Request, Response } from "express";
import { normalizePayloadTextFields } from "@/shared/utils/textNormalization";

const isNormalizablePayload = (value: unknown): boolean =>
  Boolean(value) && typeof value === "object";

export const normalizeTextPayload = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!isNormalizablePayload(req.body)) {
    next();
    return;
  }

  req.body = normalizePayloadTextFields(req.body);
  next();
};
