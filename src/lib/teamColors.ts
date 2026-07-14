export interface TeamColorConfig {
  key: string
  name: string
  bg: string          // very light bg for player cells/panels
  text: string        // dark text for high readability
  border: string      // border color
  hover: string       // hover background
  badge: string       // solid background color for badges/icons
  textLight: string   // slightly lighter but high contrast text color
  hue: number         // hue value for HSL styling
}

export const TEAM_COLORS: Record<string, TeamColorConfig> = {
  emerald: {
    key: "emerald",
    name: "Emerald",
    bg: "bg-emerald-50",
    text: "text-emerald-950",
    border: "border-emerald-500",
    hover: "hover:bg-emerald-100",
    badge: "bg-emerald-500",
    textLight: "text-emerald-805",
    hue: 142
  },
  red: {
    key: "red",
    name: "Red",
    bg: "bg-red-50",
    text: "text-red-955",
    border: "border-red-500",
    hover: "hover:bg-red-100",
    badge: "bg-red-500",
    textLight: "text-red-800",
    hue: 0
  },
  blue: {
    key: "blue",
    name: "Blue",
    bg: "bg-blue-50",
    text: "text-blue-955",
    border: "border-blue-500",
    hover: "hover:bg-blue-100",
    badge: "bg-blue-500",
    textLight: "text-blue-800",
    hue: 217
  },
  amber: {
    key: "amber",
    name: "Amber",
    bg: "bg-amber-50",
    text: "text-amber-955",
    border: "border-amber-500",
    hover: "hover:bg-amber-100",
    badge: "bg-amber-500",
    textLight: "text-amber-800",
    hue: 45
  },
  purple: {
    key: "purple",
    name: "Purple",
    bg: "bg-purple-50",
    text: "text-purple-955",
    border: "border-purple-500",
    hover: "hover:bg-purple-100",
    badge: "bg-purple-500",
    textLight: "text-purple-800",
    hue: 270
  },
  indigo: {
    key: "indigo",
    name: "Indigo",
    bg: "bg-indigo-50",
    text: "text-indigo-955",
    border: "border-indigo-500",
    hover: "hover:bg-indigo-100",
    badge: "bg-indigo-500",
    textLight: "text-indigo-805",
    hue: 239
  },
  orange: {
    key: "orange",
    name: "Orange",
    bg: "bg-orange-50",
    text: "text-orange-955",
    border: "border-orange-500",
    hover: "hover:bg-orange-100",
    badge: "bg-orange-500",
    textLight: "text-orange-800",
    hue: 24
  },
  pink: {
    key: "pink",
    name: "Pink",
    bg: "bg-pink-50",
    text: "text-pink-955",
    border: "border-pink-500",
    hover: "hover:bg-pink-100",
    badge: "bg-pink-500",
    textLight: "text-pink-805",
    hue: 330
  },
  cyan: {
    key: "cyan",
    name: "Cyan",
    bg: "bg-cyan-50",
    text: "text-cyan-955",
    border: "border-cyan-500",
    hover: "hover:bg-cyan-100",
    badge: "bg-cyan-500",
    textLight: "text-cyan-805",
    hue: 188
  }
}

export const TEAM_COLOR_LIST = [
  "emerald", "red", "blue",
  "amber", "purple", "indigo",
  "orange", "pink", "cyan"
]

export function getTeamColorConfig(colorKey: string | null | undefined, index: number): TeamColorConfig {
  if (colorKey && TEAM_COLORS[colorKey]) {
    return TEAM_COLORS[colorKey]
  }
  // fallback mapping based on team index
  const defaultKeys = ["emerald", "red", "blue", "amber", "purple", "indigo", "orange", "pink", "cyan"]
  const key = defaultKeys[index % defaultKeys.length]
  return TEAM_COLORS[key]
}
