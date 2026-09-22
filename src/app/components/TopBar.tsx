"use client"

import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Home, LogOut, RefreshCw, Share2, CheckCircle } from 'lucide-react'
import { useState } from 'react'

export default function TopBar() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      navigator.clipboard.writeText(url.toString())
        .then(() => {
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2000);
        })
        .catch(err => console.error('Could not copy URL: ', err));
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between bg-white/45 backdrop-blur-md px-4 py-2.5 md:py-4 shadow-sm border-b border-slate-250">
      <div className="flex items-center space-x-2">
        <button onClick={() => router.push('/') } className="p-2 rounded-lg hover:bg-slate-100">
          <Home size={20} />
        </button>
        {session?.user && (
          <span className="text-sm text-slate-700">Logged in as {session.user.name || session.user.email}</span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleShare}
          className="p-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg border border-slate-200 transition-colors shadow-sm inline-flex items-center justify-center"
          title="Share Current View"
        >
          {shareCopied ? <CheckCircle size={16} className="text-emerald-600 animate-pulse" /> : <Share2 size={16} />}
        </button>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg border border-slate-200 transition-colors shadow-sm inline-flex items-center justify-center"
          title="Refresh Leaderboard"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin text-emerald-600" : ""} />
        </button>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-slate-100"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
