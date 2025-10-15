FROM node:18-alpine AS BUILD_IMAGE

WORKDIR /app

RUN apk update && apk add git

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY ./*.json ./pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY ./src ./src
COPY ./scripts ./scripts

RUN pnpm build

RUN pnpm install --frozen-lockfile --prod

FROM node:18-alpine
COPY --from=BUILD_IMAGE /app/lib /app/lib
COPY --from=BUILD_IMAGE /app/src/config/locales /app/lib/src/config/locales
COPY --from=BUILD_IMAGE /app/node_modules /app/node_modules

WORKDIR /app
COPY ./*.js ./package.json ./tsconfig.json ./pnpm-lock.yaml ./
COPY ./src/graphql/schema.graphql ./src/graphql/schema.graphql

USER 1000

ARG BUILDTIME
ARG COMMITHASH
ENV BUILDTIME ${BUILDTIME}
ENV COMMITHASH ${COMMITHASH}

CMD ["node", "-r", "./lib/src/services/tracing.js", "./lib/src/server/subgraph.js"]

