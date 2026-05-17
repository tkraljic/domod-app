import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'
import { cookies } from 'next/headers'

const PUBLIC_ROUTES = ['/prijava']
const COOKIE_NAME = 'domod-session'

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.some((r) => path.startsWith(r))

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const session = await decrypt(token)

  if (!isPublicRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/prijava', req.nextUrl))
  }

  if (isPublicRoute && session?.userId) {
    return NextResponse.redirect(new URL('/dostave', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|.*\\.ico$).*)'],
}
