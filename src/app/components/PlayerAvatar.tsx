"use client"

import React, { useState } from "react"
import { User } from "lucide-react"

interface PlayerAvatarProps {
  participant?: any
  user?: any
  name?: string
  size?: "xs" | "sm" | "md" | "lg"
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

  // 50% larger sizing as requested (+50% from 24-28px to 36-42px)
  let sizeClasses = "w-9 h-9 sm:w-10 sm:h-10 text-xs sm:text-sm"
  let iconSize = 18

  if (size === "xs") {
    sizeClasses = "w-7 h-7 sm:w-8 sm:h-8 text-[10px]"
    iconSize = 14
  } else if (size === "md") {
    sizeClasses = "w-12 h-12 sm:w-14 sm:h-14 text-base sm:text-lg"
    iconSize = 24
  } else if (size === "lg") {
    sizeClasses = "w-16 h-16 sm:w-20 sm:h-20 text-xl"
    iconSize = 32
  }

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
      {initials ? initials : <User size={iconSize} className="opacity-60" />}
    </div>
  )
}
