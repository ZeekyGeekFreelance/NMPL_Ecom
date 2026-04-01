import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
};

export function ok<T>(data: T, message?: string, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data, message },
    { status }
  );
}

export function created<T>(data: T, message = "Created") {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data, message },
    { status: 201 }
  );
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function error(message: string, status = 400, errors?: Record<string, string[]>) {
  return NextResponse.json<ApiResponse>(
    { success: false, message, errors },
    { status }
  );
}

export function unauthorized(message = "Unauthorized") {
  return error(message, 401);
}

export function forbidden(message = "Forbidden") {
  return error(message, 403);
}

export function notFound(message = "Not found") {
  return error(message, 404);
}

export function conflict(message: string) {
  return error(message, 409);
}

export function serverError(message = "Internal server error") {
  return error(message, 500);
}

export function validationError(err: ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of err.errors) {
    const key = issue.path.join(".") || "root";
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return NextResponse.json<ApiResponse>(
    { success: false, message: "Validation failed", errors },
    { status: 422 }
  );
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) return validationError(err);
  if (err instanceof AppError) return error(err.message, err.status);
  console.error("[API Error]", err);
  return serverError();
}

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}
