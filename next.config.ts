import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    BACKEND_API_URL:
      process.env.BACKEND_API_URL ??
      "https://stash-api-production-7f18.up.railway.app",
  },
};

export default nextConfig;
