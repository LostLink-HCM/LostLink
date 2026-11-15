const NO_TAB_BAR = ['/messages', '/notifications']

export const hidesTabBar = (pathname) =>
  NO_TAB_BAR.some((path) => pathname === path || pathname.startsWith(`${path}/`))
