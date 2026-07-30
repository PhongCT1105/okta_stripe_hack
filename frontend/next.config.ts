import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

const projectsEnv = resolve(process.cwd(), "../.env");

if (existsSync(projectsEnv)) {
  process.loadEnvFile(projectsEnv);
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
