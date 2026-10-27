"use client"

import React, { useState } from "react"
import { User } from "lucide-react"

interface PlayerAvatarProps {
  participant?: any
  user?: any
  name?: string
  size?: "sm" | "md"
  className?: string
}

export function PlayerAvatar({ participant, user, name: propName, size = "sm", className = "" }: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false)

  const resolvedUser = user || participant?.user
  const imageUrl = resolvedUser?.image
  const resolvedName = propName || resolvedUser?.name || participant?.dummyName || "Spieler"

  // Get initials (up to 2 characters)
  const getInitials = (n: string) => {
    if (!n) return ""
    const parts = n.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const initials = getInitials(resolvedName)

  // Size styling
  const sizeClasses = size === "sm" 
    ? "w-6 h-6 sm:w-7 sm:h-7 text-[9px] sm:text-[10px]" 
    : "w-8 h-8 sm:w-9 sm:h-9 text-xs"

  if (imageUrl && !imageError) {
    return (
      <img
        src={imageUrl}
        alt={resolvedName}
        title={resolvedName}
        onError={() => setImageError(true)}
        className={`${sizeClasses} rounded-full object-cover shrink-0 border border-slate-300 shadow-xs ring-1 ring-black/5 ${className}`}
      />
    )
  }

  return (
    <div
      title={resolvedName}
      className={`${sizeClasses} rounded-full bg-slate-200 text-slate-650 font-black flex items-center justify-center shrink-0 border border-slate-300/80 select-none shadow-2xs ${className}`}
    >
      {initials ? initials : <User size={12} className="opacity-60" />}
    </div>
  )
}
