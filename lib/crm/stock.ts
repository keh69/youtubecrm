// 종목명 규칙(서버·화면 공용): 영문은 항상 대문자(kbi메탈 → KBI메탈), 앞뒤 공백 빼고 공백은 한 칸으로.
// 같은 종목이 대소문자만 달라 종목별 통계가 갈라지지 않게 한다(2026-11-16).
export const upperEn = (s: string) => s.replace(/[a-z]/g, (c) => c.toUpperCase())
export const normalizeStockName = (s: string) => upperEn(s.trim().replace(/\s+/g, ' '))
