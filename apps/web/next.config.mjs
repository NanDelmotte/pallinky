/** * Path: apps/web/next.config.mjs 
 * Description: Configuration for the Web workspace. 
 * Enables standalone output for Fly.io and transpiles the shared core package.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Ensures the build includes the shared core package from the monorepo root
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@pallinky/core'],
};

export default nextConfig;