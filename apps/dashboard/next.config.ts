import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack tries to infer a workspace root by walking up for lockfiles.
  // In the Codex sandbox this can hit restricted folders (e.g. Desktop root),
  // so we pin the root to this app directory.
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
};

export default nextConfig;
