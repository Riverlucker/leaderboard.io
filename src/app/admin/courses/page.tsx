import prisma from "@/lib/prisma"
import Link from "next/link"
import { Pencil } from "lucide-react"

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
      <h1 className="text-3xl font-bold mb-8">Manage Courses</h1>
      
      <div className="space-y-8">
        {courses.map(course => (
          <div key={course.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md relative group">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-emerald-400">{course.name}</h2>
              <Link 
                href={`/admin/courses/${course.id}`}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors text-sm font-medium border border-slate-700"
              >
                <Pencil size={14} />
                <span>Edit Course</span>
              </Link>
            </div>
            
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Tees</h3>
              <div className="flex flex-wrap gap-3">
                {course.tees.map(tee => (
                  <div key={tee.id} className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm">
                    <span className="font-bold mr-2">{tee.name}</span>
                    <span className="text-slate-400 text-xs">CR: {tee.courseRating} | Slope: {tee.slope}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Holes ({course.holes.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="px-4 py-2 rounded-tl-lg">Hole</th>
                      {course.holes.map(h => (
                        <th key={h.id} className="px-2 py-2 text-center">{h.number}</th>
                      ))}
                      <th className="px-4 py-2 rounded-tr-lg text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="px-4 py-3 font-medium text-slate-300">Par</td>
                      {course.holes.map(h => (
                        <td key={h.id} className="px-2 py-3 text-center text-slate-300">{h.par}</td>
                      ))}
                      <td className="px-4 py-3 text-center font-bold">{course.holes.reduce((sum, h) => sum + h.par, 0)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-300">Stroke Index</td>
                      {course.holes.map(h => (
                        <td key={h.id} className="px-2 py-3 text-center text-slate-400">{h.strokeIndex}</td>
                      ))}
                      <td className="px-4 py-3 text-center">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
