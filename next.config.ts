import type { NextConfig } from 'next'

// 홈페이지(/)·로그인(/login) 주소의 스킨 이동은 proxy.ts 가 쿠키를 보고 처리한다.
const nextConfig: NextConfig = {
  reactStrictMode: true
}

export default nextConfig
