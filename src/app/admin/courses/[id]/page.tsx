import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { EditCourseClient } from "./EditCourseClient"

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  
  const course = await prisma.course.findUnique({
    where: { id: resolvedParams.id },
    include: {
      holes: { orderBy: { number: 'asc' } },
      tees: true
    }
  })

  if (!course) {
    notFound()
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-slate-300">Edit Course</h1>
      <EditCourseClient course={course} />
    </div>
  )
}
