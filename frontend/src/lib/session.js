let session = { user: null, accessToken: null }

export const setSession = ({ user, accessToken }) => {
  session = { user, accessToken }
}

export const clearSession = () => {
  session = { user: null, accessToken: null }
}

export const getAccessToken = () => session.accessToken

export const getUser = () => session.user

export const homePathFor = (user) =>
  ['moderator', 'admin'].includes(user?.role) ? '/moderator' : '/'
