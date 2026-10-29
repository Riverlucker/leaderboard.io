import { type DefaultSession } from "next-auth"

export type ExtendedUser = DefaultSession["user"] & {
  id: string
  role: "USER" | "ADMIN" | "SUPER_ADMIN"
}

declare module "next-auth" {
  interface User { role: "USER" | "ADMIN" | "SUPER_ADMIN" }
  interface Session {
    user: ExtendedUser
  }
}

import "next-auth/jwt"

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: "USER" | "ADMIN" | "SUPER_ADMIN"
  }
}
