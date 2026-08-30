/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone bundles only the modules the server actually reaches, giving a
  // much smaller resident footprint than `next start` over the full app dir.
  // Railway bills memory per minute, so the baseline matters more than usual.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
