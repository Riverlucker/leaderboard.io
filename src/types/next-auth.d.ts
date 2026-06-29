import NextAuth, { type DefaultSession } from "next-auth"

export type ExtendedUser = DefaultSession["user"] & {
  id: string
  role: "USER" | "ADMIN" | "SUPER_ADMIN"
}

declare module "next-auth" {
  interface Session {
    user: ExtendedUser
  }
}

import { JWT } from "next-auth/jwt"

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: "USER" | "ADMIN" | "SUPER_ADMIN"
  }
}
