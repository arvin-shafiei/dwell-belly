import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Next only reads env files next to this app. The CLI scripts also read one at the repo root, so
// the server does too; values already set (including this app's own env files) are not replaced.
const rootEnv = path.resolve(process.cwd(), "..", "..", ".env.local");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
