import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};

    // html-to-docx has an optional dependency on `encoding` that is not required
    // by our runtime path. Silence build-time module resolution warnings.
    config.resolve.alias.encoding = false;

    return config;
  }
};

export default nextConfig;
