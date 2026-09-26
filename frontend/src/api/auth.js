import { api } from '../lib/api'

export const register = (payload) => api.post('/auth/register', payload)

export const verifyEmail = (payload) => api.post('/auth/verify-email', payload)

export const resendCode = (email) => api.post('/auth/resend-code', { email })
