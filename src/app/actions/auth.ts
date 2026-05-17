'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession } from '@/lib/session'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginState =
  | { error: string }
  | { error: null }
  | undefined

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Nevažeći email ili lozinka.' }
  }

  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.active) {
    return { error: 'Pogrešan email ili lozinka.' }
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    return { error: 'Pogrešan email ili lozinka.' }
  }

  await createSession({ userId: user.id, role: user.role, fullName: user.fullName })
  redirect('/dostave')
}

export async function logout() {
  await deleteSession()
  redirect('/prijava')
}
