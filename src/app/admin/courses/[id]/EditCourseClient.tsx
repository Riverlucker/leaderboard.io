"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateCourse } from "./actions"
import { Save, Plus, Trash2 } from "lucide-react"

export function EditCourseClient({ course }: { course: any }) {
  const router = useRouter()
  const [name, setName] = useState(course.name)
  const [holes, setHoles] = useState(course.holes)
  const [tees, setTees] = useState(course.tees)
  const [isSaving, setIsSaving] = useState(false)

  const handleHoleChange = (id: string, field: string, value: string) => {
    setHoles(holes.map((h: any) => h.id === id ? { ...h, [field]: value } : h))
  }

  const handleTeeChange = (id: string, field: string, value: string) => {
    setTees(tees.map((t: any) => t.id === id ? { ...t, [field]: value } : t))
  }

  const addTee = () => {
    setTees([...tees, { id: `new_${Date.now()}`, name: "New Tee", courseRating: 72, slope: 113 }])
  }

  const removeTee = (id: string) => {
    setTees(tees.filter((t: any) => t.id !== id))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateCourse(course.id, { name, holes, tees })
      router.push("/admin/courses")
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex justify-between items-center bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Course Name</label>
          <input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-xl font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-96"
          />
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          <Save size={18} />
          <span>{isSaving ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>

      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-200">Tees</h3>
          <button onClick={addTee} className="flex items-center space-x-1 text-sm text-emerald-400 hover:text-emerald-300">
            <Plus size={16} /> <span>Add Tee</span>
          </button>
        </div>
        
        <div className="space-y-3">
          {tees.map((tee: any) => (
            <div key={tee.id} className="flex items-center space-x-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Name / Color</label>
                <input value={tee.name} onChange={e => handleTeeChange(tee.id, 'name', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm" />
              </div>
              <div className="w-24">
                <label className="block text-xs text-slate-500 mb-1">Rating</label>
                <input value={tee.courseRating} onChange={e => handleTeeChange(tee.id, 'courseRating', e.target.value)} type="number" step="0.1" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm" />
              </div>
              <div className="w-24">
                <label className="block text-xs text-slate-500 mb-1">Slope</label>
                <input value={tee.slope} onChange={e => handleTeeChange(tee.id, 'slope', e.target.value)} type="number" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm" />
              </div>
              <button onClick={() => removeTee(tee.id)} className="mt-5 text-slate-500 hover:text-red-400 p-2">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <h3 className="text-lg font-bold text-slate-200 mb-4">Holes (1-18)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {holes.map((hole: any) => (
            <div key={hole.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-center">
              <div className="font-bold text-slate-300 mb-3 border-b border-slate-800 pb-2">Hole {hole.number}</div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Par</label>
                  <input value={hole.par} onChange={e => handleHoleChange(hole.id, 'par', e.target.value)} type="number" min="3" max="5" className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-center mx-auto" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Stroke Index</label>
                  <input value={hole.strokeIndex} onChange={e => handleHoleChange(hole.id, 'strokeIndex', e.target.value)} type="number" min="1" max="18" className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-center mx-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
