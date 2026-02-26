/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((origin) => origin.trim())
    : undefined,
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    }
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false
    };

    if (isServer) {
      config.externals = [...(config.externals || []), "canvas"];
    }

    return config;
  }
};

export default nextConfig;
