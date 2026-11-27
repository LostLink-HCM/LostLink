const FEED_PATHS = ['/', '/trending']

export const isFeedPath = (pathname) => FEED_PATHS.includes(pathname)
