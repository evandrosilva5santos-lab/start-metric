import { z, ZodSchema } from "zod";
import { NextResponse } from "next/server";

export function parseSearchParams<T>(
  schema: ZodSchema<T>,
  params: URLSearchParams,
): { data: T } | { error: NextResponse } {
  const raw = Object.fromEntries(params.entries());
  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: "Invalid query parameters", details: result.error.flatten().fieldErrors },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}
