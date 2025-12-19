# syntax=docker/dockerfile:1

FROM node:lts-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:lts-alpine AS final
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 9000
CMD ["node", "dist/src/index.js"]