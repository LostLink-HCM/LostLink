import { api } from '../lib/api'

const pub = { auth: false }

export const register = (payload) => api.post('/auth/register', payload, pub)

export const verifyEmail = (payload) => api.post('/auth/verify-email', payload, pub)

export const resendCode = (email) => api.post('/auth/resend-code', { email }, pub)

export const login = (payload) => api.post('/auth/login', payload, pub)

// Backend đọc refresh token từ cookie nên không cần access token
export const logout = () => api.post('/auth/logout', undefined, pub)
