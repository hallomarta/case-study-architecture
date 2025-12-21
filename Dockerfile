# syntax=docker/dockerfile:1

FROM node:lts-alpine AS builder
WORKDIR /app

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source and prisma schema
COPY . .

# Generate Prisma Client (needs dummy DATABASE_URL for build)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN yarn prisma generate

# Build application
RUN yarn build

FROM node:lts-alpine AS final
WORKDIR /app

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install production dependencies only (Yarn 4 syntax)
ENV NODE_ENV=production
RUN yarn install --immutable

# Copy built app and prisma files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 9000

# Start server (migrations should be run separately in CI/CD)
CMD ["node", "dist/src/index.js"]