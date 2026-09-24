import type { NextConfig } from "next";

const now = new Date();
const day = now.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit" });
const month = now.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", month: "2-digit" });
const hour = now.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit" });
const minute = now.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", minute: "2-digit" });
const buildTime = `${day}${month}_${hour}${minute}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
