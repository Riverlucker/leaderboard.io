import type { NextConfig } from "next";

const now = new Date();
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const parts = formatter.formatToParts(now);
const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
const buildTime = `${getPart("day")}${getPart("month")}_${getPart("hour")}${getPart("minute")}`;

const nextConfig: NextConfig = {
  async headers() {
    return [{source:"/profile/:path*",headers:[{key:"Referrer-Policy",value:"no-referrer"},{key:"X-Robots-Tag",value:"noindex, nofollow"}]}];
  },
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
