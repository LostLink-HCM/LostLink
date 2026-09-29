// Access token chỉ giữ trong bộ nhớ (không localStorage) để JS lạ không đọc được qua XSS.
// Tải lại trang thì mất, AuthProvider gọi /auth/refresh bằng cookie httpOnly để lấy lại.
let accessToken = null

export const getAccessToken = () => accessToken

export const setAccessToken = (token) => {
  accessToken = token
}

export const homePathFor = (user) =>
  ['moderator', 'admin'].includes(user?.role) ? '/moderator' : '/'
