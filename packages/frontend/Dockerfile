FROM oven/bun:1.2-alpine AS builder
WORKDIR /app
COPY packages/frontend/package.json packages/frontend/
RUN cd packages/frontend && bun install
COPY packages/frontend/ packages/frontend/
WORKDIR /app/packages/frontend
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN bun run build

FROM nginx:alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
