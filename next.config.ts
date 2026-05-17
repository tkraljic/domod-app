import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Bundle the generated Prisma client (custom output dir) into serverless functions.
  outputFileTracingIncludes: {
    '/*': ['src/generated/prisma/**/*'],
  },
};

export default nextConfig;
