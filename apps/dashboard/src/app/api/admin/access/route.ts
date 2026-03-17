import { NextResponse } from "next/server";
import { requireAdminOrgContext } from "@/lib/admin/context";

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();

  if (!auth.ok) {
    return auth.error;
  }

  return NextResponse.json({
    ok: true,
    admin: {
      userId: auth.context.userId,
      email: auth.context.userEmail,
      name: auth.context.userName,
    },
  });
}
