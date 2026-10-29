"use server"

import prisma from "@/lib/prisma"
import { atomic } from "@/lib/transaction"
import { requireAdmin } from "@/lib/access"
import { assertHandicap } from "@/lib/access-policy"

import { canManageUser } from "@/lib/access-policy"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

export async function createUser(data: {
  name?: string
  email?: string
  password?: string
  handicap?: number | null
  homeCourse?: string
  phoneNumber?: string
  role: "USER" | "ADMIN" | "SUPER_ADMIN"
}) {
  const actor = await requireAdmin()
  return atomic(async prisma => {
  if (!canManageUser(actor.role, "USER", data.role)) throw new Error("Nur Superadmins dürfen Administratoren ernennen.")
  assertHandicap(data.handicap)

  const emailVal = data.email?.trim().toLowerCase() || null
  const nameVal = data.name?.trim() || null
  const homeCourseVal = data.homeCourse?.trim() || null
  const phoneNumberVal = data.phoneNumber?.trim() || null

  let hashedPassword = null
  if (data.password && data.password.trim().length > 0) {
    hashedPassword = await bcrypt.hash(data.password, 10)
  }

  if (emailVal) {
    const existingUser = await prisma.user.findUnique({
      where: { email: emailVal }
    })
    if (existingUser) {
      throw new Error("A user with this email already exists.")
    }
  }

  await prisma.user.create({
    data: {
      name: nameVal,
      email: emailVal,
      password: hashedPassword,
      handicap: data.handicap,
      homeCourse: homeCourseVal,
      phoneNumber: phoneNumberVal,
      role: data.role
    }
  })

  revalidatePath("/admin/users")
  return { success: true }

  })
}

export async function updateUser(id: string, data: {
  name?: string
  email?: string
  password?: string
  handicap?: number | null
  homeCourse?: string
  phoneNumber?: string
  role: "USER" | "ADMIN" | "SUPER_ADMIN"
}) {
  const actor = await requireAdmin()
  return atomic(async prisma => {
  const target = await prisma.user.findUniqueOrThrow({where: {id}})
  if (!canManageUser(actor.role, target.role, data.role)) throw new Error("Keine Berechtigung für dieses Benutzerkonto.")
  assertHandicap(data.handicap)
  if (target.role === "SUPER_ADMIN" && data.role !== "SUPER_ADMIN" && await prisma.user.count({where: {role: "SUPER_ADMIN"}}) <= 1) throw new Error("Der letzte Superadmin muss erhalten bleiben.")

  const emailVal = data.email?.trim().toLowerCase() || null
  const nameVal = data.name?.trim() || null
  const homeCourseVal = data.homeCourse?.trim() || null
  const phoneNumberVal = data.phoneNumber?.trim() || null

  if (emailVal) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: emailVal,
        id: { not: id }
      }
    })
    if (existingUser) {
      throw new Error("A user with this email already exists.")
    }
  }

  const updateData: any = {
    name: nameVal,
    email: emailVal,
    handicap: data.handicap,
    homeCourse: homeCourseVal,
    phoneNumber: phoneNumberVal,
    role: data.role
  }

  if (data.password && data.password.trim().length > 0) {
    updateData.password = await bcrypt.hash(data.password, 10)
  }

  await prisma.user.update({
    where: { id },
    data: updateData
  })

  revalidatePath("/admin/users")
  revalidatePath(`/admin/users/${id}`)
  return { success: true }

  })
}

export async function deleteUser(id: string) {
  const actor = await requireAdmin()
  return atomic(async prisma => {
  const target = await prisma.user.findUniqueOrThrow({where: {id}})
  if (!canManageUser(actor.role, target.role, target.role)) throw new Error("Keine Berechtigung für dieses Benutzerkonto.")

  if (target.role === "SUPER_ADMIN" && true && await prisma.user.count({where: {role: "SUPER_ADMIN"}}) <= 1) throw new Error("Der letzte Superadmin muss erhalten bleiben.")

  await prisma.user.delete({
    where: { id }
  })

  revalidatePath("/admin/users")
  return { success: true }

  })
}
