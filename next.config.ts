import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/ask': ['./data/**'],
  },
  // Transformers.js + ONNX 런타임은 Next.js webpack이 번들링하지 않도록 제외
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
};

export default nextConfig;
