import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack's persistent dev cache (.next/dev/cache/turbopack) grew
    // unbounded to multiple GB in a single session and OOM'd the dev
    // server. Disable it until Turbopack bounds cache size itself.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
