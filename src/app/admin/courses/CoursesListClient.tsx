"use client"

import { useState } from "react"
import Link from "next/link"
import { Pencil, ChevronDown, ChevronUp } from "lucide-react"

interface Course {
  id: string
  name: string
  tees: Array<{ id: string; name: string; courseRating: number; slope: number }>
  holes: Array<{ id: string; number: number; par: number; strokeIndex: number }>
}

export function CoursesListClient({ courses }: { courses: Course[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  const toggleExpand = (id: string) => {
    if (expandedIds.includes(id)) {
      setExpandedIds(expandedIds.filter(x => x !== id))
    } else {
      setExpandedIds([...expandedIds, id])
    }
  }

  return (
    <div className="space-y-4">
      {courses.map(course => {
        const isExpanded = expandedIds.includes(course.id)
        const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0)

        return (
          <div key={course.id} className="bg-slate-900 border border-slate-800 rounded-xl shadow-md transition-all overflow-hidden">
            {/* Header row / One-liner */}
            <div 
              onClick={() => toggleExpand(course.id)}
              className="flex justify-between items-center p-5 cursor-pointer select-none hover:bg-slate-850/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <button type="button" className="text-slate-400 hover:text-slate-200 focus:outline-none">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                <h2 className="text-lg font-bold text-slate-100">{course.name}</h2>
                <span className="text-xs text-slate-500 bg-slate-950 border border-slate-850 px-2.5 py-0.5 rounded-full font-mono">
                  {course.tees.length} Tees | {course.holes.length} Holes (Par {totalPar})
                </span>
              </div>
              <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                <Link 
                  href={`/admin/courses/${course.id}`}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-lg transition-all text-xs font-semibold border border-slate-700 shadow-sm"
                >
                  <Pencil size={12} />
                  <span>Edit Course</span>
                </Link>
              </div>
            </div>

            {/* Collapsible Details */}
            {isExpanded && (
              <div className="p-6 border-t border-slate-850 bg-slate-905/30 space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tees</h3>
                  <div className="flex flex-wrap gap-3">
                    {course.tees.map(tee => (
                      <div key={tee.id} className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm">
                        <span className="font-bold mr-2 text-slate-300">{tee.name}</span>
                        <span className="text-slate-400 text-xs">CR: {tee.courseRating} | Slope: {tee.slope}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Holes ({course.holes.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="px-4 py-2 rounded-tl-lg text-xs uppercase font-semibold text-slate-500">Hole</th>
                          {course.holes.map(h => (
                            <th key={h.id} className="px-2 py-2 text-center text-xs font-bold">{h.number}</th>
                          ))}
                          <th className="px-4 py-2 rounded-tr-lg text-center text-xs uppercase font-semibold text-slate-500">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-800/80">
                          <td className="px-4 py-3 font-semibold text-slate-350">Par</td>
                          {course.holes.map(h => (
                            <td key={h.id} className="px-2 py-3 text-center text-slate-300">{h.par}</td>
                          ))}
                          <td className="px-4 py-3 text-center font-bold text-emerald-450">{totalPar}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-semibold text-slate-450">Stroke Index</td>
                          {course.holes.map(h => (
                            <td key={h.id} className="px-2 py-3 text-center text-slate-500">{h.strokeIndex}</td>
                          ))}
                          <td className="px-4 py-3 text-center text-slate-500">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
