import "server-only"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { isAdmin } from "./access-policy"

export async function requireAdminPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) redirect("/login")
  return session
}
