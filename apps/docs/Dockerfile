# The site, built and run with Bun. Two stages, so the runtime image carries no
# dev dependencies and no `tools/`.
#
# The build context is the repository root, not this directory: the site's
# loaders reach `openapi.json` and `tools/spec.ts` through the two aliases in
# `svelte.config.js`, because one reader shared with the six libraries is the
# whole point — a second copy here would be a reference that could disagree with
# the clients it documents.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app/apps/docs

# This directory's own manifests, and nothing from the root.
#
# `apps/docs` is deliberately *not* a member of the root workspace — it is the
# one thing here that depends on the private kit, and a workspace member's
# dependency is everybody's `bun install`. So it has its own lockfile, and this
# used to copy the root's: `bun install --frozen-lockfile` then found a lockfile
# that knew nothing about any of these dependencies and refused with "lockfile
# had changes, but lockfile is frozen".
COPY apps/docs/package.json apps/docs/bun.lock apps/docs/.npmrc ./

# `@cyka/ui` is a private package in the group's registry, and `.npmrc` above
# says where and under which variable the token is. The token is a mounted
# secret rather than a `--build-arg`: an argument is in the image history and in
# a layer, readable by anybody who pulls the image, and a mount is in neither.
#
# It fails *open* when nothing is mounted, so a shell that already exports the
# variable builds the same image.
RUN --mount=type=secret,id=npm_token \
    sh -euc '\
      if [ -s /run/secrets/npm_token ]; then \
        CYKA_NPM_TOKEN="$(cat /run/secrets/npm_token)"; \
        export CYKA_NPM_TOKEN; \
      fi; \
      bun install --frozen-lockfile'

# The contract and the reader, at the paths the two aliases expect, then the
# site itself. `node_modules` is not overwritten: `COPY` merges, and
# `.dockerignore` keeps it out of the context anyway.
COPY openapi.json /app/openapi.json
COPY tools /app/tools
COPY apps/docs ./

RUN bun run build

FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app/apps/docs
ENV NODE_ENV=production

# The layout is kept as it was built. `adapter-node` bundles what it can and
# leaves the rest external, so the server still resolves out of the
# `node_modules` beside it — flattening the two into one directory is how a
# route comes to answer 500 while a healthcheck that touches nothing keeps
# reporting the container healthy.
COPY --from=build /app/apps/docs/package.json ./package.json
COPY --from=build /app/apps/docs/node_modules ./node_modules
COPY --from=build /app/apps/docs/build ./build

EXPOSE 3000
ENV PORT=3000
CMD ["bun", "./build/index.js"]
