import { NextResponse } from "next/server";
import { destroySession } from "../../../../lib/auth";
import { rejectCrossOrigin } from "../../../../lib/request-security";
import { appUrl } from "../../../../lib/app-url";

export async function POST(request: Request) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  await destroySession();
  return NextResponse.redirect(appUrl(request, "/app/login"), 303);
}
