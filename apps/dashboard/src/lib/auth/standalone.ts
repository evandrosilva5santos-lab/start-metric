import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export function isAuthorizedDashboard(req: NextRequest | Request): boolean {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return process.env.NODE_ENV !== "production";
  }

  const headerVal = req.headers.get("x-dashboard-password") || "";
  const bufA = Buffer.from(String(headerVal), "utf8");
  const bufB = Buffer.from(String(password), "utf8");

  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
