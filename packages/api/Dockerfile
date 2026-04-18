FROM oven/bun:1.2-alpine
WORKDIR /app
COPY packages/api/package.json ./
RUN bun install
COPY packages/api/src ./src
RUN mkdir -p /data
EXPOSE 4000
CMD ["bun", "src/index.ts"]
