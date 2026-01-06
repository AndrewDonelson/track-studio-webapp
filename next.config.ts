import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'http://192.168.1.200:3000',
    // Add more origins as needed
  ],
};

export default nextConfig;
