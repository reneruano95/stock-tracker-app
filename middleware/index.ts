import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Authentication disabled - allow all requests
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|assets).*)"],
};
