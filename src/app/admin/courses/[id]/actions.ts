"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateCourse(courseId: string, data: any) {
  // Update the basic course info
  await prisma.course.update({
    where: { id: courseId },
    data: {
      name: data.name
    }
  })

  // Update holes (assuming they exist, if not we'd create them, but we seeded 18 for all)
  for (const hole of data.holes) {
    await prisma.hole.update({
      where: { id: hole.id },
      data: {
        par: parseInt(hole.par),
        strokeIndex: parseInt(hole.strokeIndex)
      }
    })
  }

  // Handle tees
  // For simplicity, we can delete existing and recreate, or update existing.
  // Since tees might be added/removed, delete and recreate is easiest for now.
  await prisma.tee.deleteMany({
    where: { courseId: courseId }
  })
  
  for (const tee of data.tees) {
    await prisma.tee.create({
      data: {
        courseId: courseId,
        name: tee.name,
        courseRating: parseFloat(tee.courseRating),
        slope: parseInt(tee.slope)
      }
    })
  }

  revalidatePath("/admin/courses")
  revalidatePath(`/admin/courses/${courseId}`)
  
  return { success: true }
}
