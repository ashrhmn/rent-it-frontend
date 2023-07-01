/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  rewrites: () => [
    {
      source: "/api",
      destination:
        (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000") +
        "/graphql",
    },
  ],
};

module.exports = nextConfig;
