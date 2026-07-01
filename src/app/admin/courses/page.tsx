import prisma from "@/lib/prisma"
import { CoursesListClient } from "./CoursesListClient"

export default async function AdminCourses() {
  const courses = await prisma.course.findMany({
    include: {
      holes: {
        orderBy: { number: 'asc' }
      },
      tees: true
    },
    orderBy: { name: 'asc' }
  })

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8 text-slate-100">Manage Courses</h1>
      <CoursesListClient courses={courses} />
    </div>
  )
}
