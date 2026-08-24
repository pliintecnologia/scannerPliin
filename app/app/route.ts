import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "../../lib/app-url";

export function GET(request: NextRequest) {
  return NextResponse.redirect(appUrl(request, "/consultas"));
}
