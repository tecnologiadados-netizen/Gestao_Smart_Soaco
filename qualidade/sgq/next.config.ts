import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const basePath = "/qualidade/sgq";
const sgqRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath,
  turbopack: {
    root: sgqRoot,
  },
};

export default nextConfig;
