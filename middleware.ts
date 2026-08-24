import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/auth-constants";
import { appUrl } from "./lib/app-url";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/app/login") {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = appUrl(request, "/app/login");
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/consultas/:path*", "/assinatura/:path*"] };
