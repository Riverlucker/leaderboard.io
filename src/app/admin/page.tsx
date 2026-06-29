import prisma from "@/lib/prisma"

export default async function AdminDashboard() {
  const compCount = await prisma.competition.count()
  const userCount = await prisma.user.count()
  const courseCount = await prisma.course.count()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <h3 className="text-slate-400 font-medium mb-2">Total Competitions</h3>
          <p className="text-4xl font-bold text-emerald-400">{compCount}</p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <h3 className="text-slate-400 font-medium mb-2">Registered Users</h3>
          <p className="text-4xl font-bold text-cyan-400">{userCount}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <h3 className="text-slate-400 font-medium mb-2">Available Courses</h3>
          <p className="text-4xl font-bold text-indigo-400">{courseCount}</p>
        </div>
      </div>
    </div>
  )
}
