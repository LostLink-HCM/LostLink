import { api } from '../lib/api'

// Gọi VietMap qua backend (key nằm ở server), chỉ trả kết quả thuộc TP.HCM cũ

// Tìm địa chỉ khi người dùng bấm Tìm
export const searchPlaces = (text) => api.get(`/geo/search?${new URLSearchParams({ text })}`)

// Toạ độ của kết quả tìm kiếm đã chọn
export const getPlace = (refId) => api.get(`/geo/place?${new URLSearchParams({ refId })}`)

// Địa chỉ, khu vực của toạ độ; ngoài TP.HCM thì lỗi 422 OUTSIDE_HCM
export const reversePoint = ({ lat, lng }) =>
  api.get(`/geo/reverse?${new URLSearchParams({ lat, lng })}`)
