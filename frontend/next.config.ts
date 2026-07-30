import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

const projectsEnv = resolve(process.cwd(), "../.env");

if (existsSync(projectsEnv)) {
  process.loadEnvFile(projectsEnv);
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Proof submissions carry a handful of base64 JPEG frames sampled from
      // the member's recording. Six frames at ~900px clear the 1MB default,
      // and base64 adds a third on top of that.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
