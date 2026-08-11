"use client"

import React, { useEffect, useRef } from "react"
import { History } from "lucide-react"

export interface ContextMenuOption {
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

interface ContextMenuProps {
  x: number
  y: number
  options: ContextMenuOption[]
  onClose: () => void
}

export function ContextMenu({ x, y, options, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  // Adjust coordinates if menu overflows window
  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1000
  const windowHeight = typeof window !== "undefined" ? window.innerHeight : 800

  const adjustedX = Math.min(x, windowWidth - 220)
  const adjustedY = Math.min(y, windowHeight - (options.length * 44 + 20))

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-[100] bg-slate-900/95 border border-slate-700/80 text-white rounded-xl shadow-2xl backdrop-blur-md p-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="space-y-1">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => {
              opt.onClick()
              onClose()
            }}
            className="w-full text-left flex items-center space-x-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-200 hover:text-white hover:bg-emerald-600/80 transition-colors cursor-pointer"
          >
            {opt.icon || <History size={14} className="text-emerald-400" />}
            <span className="truncate">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
