FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json tsconfig.json tsconfig.build.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system pakworker \
  && useradd --system --gid pakworker --create-home pakworker
WORKDIR /app
COPY --from=build /app/dist ./dist
USER pakworker
CMD ["node", "dist/index.js"]
