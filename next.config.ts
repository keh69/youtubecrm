import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 기본 디자인은 v5. 예전 주소(/, /login)로 들어와도 v5 로 보낸다.
  async redirects() {
    return [
      { source: '/', destination: '/v5', permanent: false },
      { source: '/login', destination: '/v5/login', permanent: false }
    ]
  }
}

export default nextConfig
