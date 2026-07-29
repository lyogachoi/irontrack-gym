import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const pagesBasePath = isGitHubPages ? "/irontrack-gym" : "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(isGitHubPages ? {
    output: "export" as const,
    basePath: pagesBasePath,
    assetPrefix: pagesBasePath,
    trailingSlash: true,
  } : {}),
};

export default nextConfig;
