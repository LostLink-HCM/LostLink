# syntax=docker/dockerfile:1

# ---- Build: Vite nhúng biến VITE_* vào bundle lúc build ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_SENTRY_DSN=
ARG VITE_FEEDBACK_FORM_URL=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_FEEDBACK_FORM_URL=$VITE_FEEDBACK_FORM_URL

RUN npm run build

# ---- Runtime: nginx phục vụ file tĩnh và proxy /api sang backend ----
FROM nginx:stable-alpine
# Vá các gói hệ điều hành của image nginx (Trivy quét ra lỗ hổng đã có bản sửa)
RUN apk upgrade --no-cache
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
