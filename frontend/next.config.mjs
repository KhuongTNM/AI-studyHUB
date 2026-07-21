
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Keep Turbopack inside this app instead of scanning user-level lockfiles.
  turbopack: {
    root: appRoot,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
}

export default nextConfig
