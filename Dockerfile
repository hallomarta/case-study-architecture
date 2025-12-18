# syntax=docker/dockerfile:1

FROM node:21-alpine3.18 AS builder
WORKDIR /app
COPY . .

ARG K8S_RDS_DB_NAME
ARG K8S_RDS_MASTER_USERNAME
ARG K8S_RDS_HOST
ARG K8S_RDS_MASTER_PASSWORD

RUN apk add openssh && \
  apk add git && \
  mkdir -p -m 0600 ~/.ssh && \
  ssh-keyscan github.com >> ~/.ssh/known_hosts
RUN --mount=type=ssh,id=github_ssh_key yarn install --production
RUN yarn build

ENV K8S_RDS_DB_NAME=$K8S_RDS_DB_NAME
ENV K8S_RDS_MASTER_USERNAME=$K8S_RDS_MASTER_USERNAME
ENV K8S_RDS_HOST=$K8S_RDS_HOST
ENV K8S_RDS_MASTER_PASSWORD=$K8S_RDS_MASTER_PASSWORD

FROM node:19-alpine3.16 AS final
WORKDIR /app
COPY ["package.json", "./"]
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 9000
CMD ["yarn", "start" ]