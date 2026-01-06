import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // 압축 활성화 (기본값이지만 명시적으로)
  compress: true,

  // MVT 타일 헤더 설정
  async headers() {
    return [
      {
        source: '/api/tiles/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, immutable' },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
      {
        source: '/tiles/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/x-protobuf' },
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' },
        ],
      },
      {
        source: '/data/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },  // 7일 캐시
        ],
      },
      {
        source: '/api/parcel/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },  // 필지 상세 1시간 캐시
        ],
      },
    ];
  },

  // 외부 이미지 도메인 허용
  images: {
    domains: ['ssl.pstatic.net', 'lh3.googleusercontent.com'],
  },

  // React Strict Mode 비활성화 (지도 이중 렌더링 방지)
  // 네이버 지도 API가 Strict Mode의 이중 마운트와 호환되지 않음
  reactStrictMode: false,

  // ESLint 빌드 시 무시 (프로덕션 배포용)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript 에러 빌드 시 무시 (이미 타입 체크 완료)
  typescript: {
    ignoreBuildErrors: true,
  },

  // 빌드 최적화
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', '@tabler/icons-react'],
  },
};

export default bundleAnalyzer(nextConfig);
