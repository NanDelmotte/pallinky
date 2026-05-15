
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: [
    '@pallinky/core',
    'expo',
    'expo-router',
    'expo-modules-core',
    'react-native',
    'react-native-web',
    'react-native-safe-area-context',
    'react-native-screens',
    'react-native-reanimated',
    'react-native-gesture-handler',
    // Navigation packages causing the ESM error
    '@react-navigation/native',
    '@react-navigation/bottom-tabs',
    '@react-navigation/elements'
  ],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native$': 'react-native-web',
    };
    return config;
  },
};

export default nextConfig;