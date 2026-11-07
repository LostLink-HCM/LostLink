# syntax=docker/dockerfile:1

# ---- Cài dependency production ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# ---- Runtime: chỉ cần `node`, không cần npm ----
FROM node:24-alpine
# Mã commit do CI truyền vào (--build-arg GIT_SHA=...), /api/health trả lại để kiểm tra bản đang chạy
ARG GIT_SHA=dev
ENV NODE_ENV=production
ENV APP_VERSION=$GIT_SHA
WORKDIR /app

# Cập nhật gói hệ điều hành và gỡ npm/corepack/yarn đi kèm image Node:
# container không dùng tới, Trivy báo lỗ hổng trong npm bundle
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
