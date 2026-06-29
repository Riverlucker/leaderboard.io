"use server"

import prisma from "@/lib/prisma"
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
  const emailVal = data.email?.trim() || null
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
  const emailVal = data.email?.trim() || null
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
}

export async function deleteUser(id: string) {
  await prisma.user.delete({
    where: { id }
  })

  revalidatePath("/admin/users")
  return { success: true }
}
