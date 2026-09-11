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

# `@cyka/ui` is `cykacloud/ui` and it is private, so the install fetches a
# repository rather than reading a folder — which needs git and a key.
RUN apk add --no-cache git openssh-client

# This directory's own manifests, and nothing from the root.
#
# `apps/docs` is deliberately *not* a member of the root workspace — it is the
# one thing here that depends on the private kit, and a workspace member's
# dependency is everybody's `bun install`. So it has its own lockfile, and this
# used to copy the root's: `bun install --frozen-lockfile` then found a lockfile
# that knew nothing about any of these dependencies and refused with "lockfile
# had changes, but lockfile is frozen".
COPY apps/docs/package.json apps/docs/bun.lock ./

# A read-only deploy key on that one repository, mounted rather than passed: a
# `--build-arg` is in the image history and in a layer, readable by anybody who
# pulls the image, and a secret mount is in neither. The newline is put back on
# because a secret handed through the environment arrives with it stripped, and
# OpenSSH answers a key without one with `invalid format` and nothing else —
# which reads exactly like a key that was never authorised.
#
# GitHub's host key is written out rather than scanned: `ssh-keyscan` would
# trust whatever answered during the build, and what this fetches is source that
# then gets compiled.
#
# It fails *open* when nothing is mounted, so a laptop whose own key GitHub
# knows reaches the same repository and needs none of this.
RUN --mount=type=secret,id=kit_key \
    sh -euc '\
      if [ -s /run/secrets/kit_key ]; then \
        mkdir -p /root/.ssh; \
        echo "[lab.cyka.cloud]:2222 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIILhRuLCfKnM/UM2r4S1h5t/svq8R/do5+zxzocJUU1r" > /root/.ssh/known_hosts; \
        cp /run/secrets/kit_key /tmp/kit_key; \
        printf "\n" >> /tmp/kit_key; \
        chmod 600 /tmp/kit_key; \
        export GIT_SSH_COMMAND="ssh -p 2222 -i /tmp/kit_key -o IdentitiesOnly=yes -o BatchMode=yes -o UserKnownHostsFile=/root/.ssh/known_hosts"; \
      fi; \
      bun install --frozen-lockfile; \
      rm -f /tmp/kit_key'

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
