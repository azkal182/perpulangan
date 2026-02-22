import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/sign-in", "/sign-up", "/login"];

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((route) => pathname === route);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const authPage = isAuthPage(pathname);
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  const isAuthenticated = Boolean(session?.session && session?.user);

  if (!isAuthenticated && !authPage) {
    const signInUrl = new URL("/sign-in", request.url);
    const callbackPath = `${pathname}${request.nextUrl.search}`;
    if (callbackPath && callbackPath !== "/") {
      signInUrl.searchParams.set("redirectTo", callbackPath);
    }

    return NextResponse.redirect(signInUrl);
  }

  if (isAuthenticated && authPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
