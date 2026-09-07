# The site, built and run with Bun. Two stages, so the runtime image carries no
# dev dependencies and no `tools/`.
#
# The build context is the repository root, not this directory: the site's
# loaders reach `openapi.json` and `tools/spec.ts` through the two aliases in
# `svelte.config.js`, because one reader shared with the six libraries is the
# whole point — a second copy here would be a reference that could disagree with
# the clients it documents.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

# `@cyka/ui` is `cykacloud/ui` and it is private, so the install fetches a
# repository rather than reading a folder — which needs git and a key.
RUN apk add --no-cache git openssh-client

# the manifests first, so editing a page does not re-resolve dependencies.
# Every workspace `bun.lock` names gets a line whether or not this image needs
# it: bun 1.3 reads a workspace the lockfile knows about and the context has not
# got as the lockfile having changed, and `--frozen-lockfile` then refuses the
# whole install.
COPY package.json bun.lock ./
COPY apps/docs/package.json ./apps/docs/
COPY packages/typescript/package.json ./packages/typescript/

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
        echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" > /root/.ssh/known_hosts; \
        cp /run/secrets/kit_key /tmp/kit_key; \
        printf "\n" >> /tmp/kit_key; \
        chmod 600 /tmp/kit_key; \
        export GIT_SSH_COMMAND="ssh -i /tmp/kit_key -o IdentitiesOnly=yes -o BatchMode=yes -o UserKnownHostsFile=/root/.ssh/known_hosts"; \
      fi; \
      bun install --frozen-lockfile; \
      rm -f /tmp/kit_key'

# the contract and the reader, then the site itself
COPY openapi.json ./openapi.json
COPY tools ./tools
COPY apps/docs ./apps/docs

WORKDIR /app/apps/docs
RUN bun run build

FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

#
# The workspace layout is kept exactly as it was built.
#
# A workspace install puts each package's dependencies under that package rather
# than all at the root, so flattening the server bundle to `/app/build` moves it
# out of reach of them: resolution walks up to an `/app/node_modules` that only
# holds the shared store and finds nothing. The site's own bundle is
# self-contained, but the shape is kept anyway — the failure it prevents shows up
# as a 500 on one route while a healthcheck that touches nothing keeps reporting
# the container healthy.
#
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/docs/package.json ./apps/docs/package.json
COPY --from=build /app/apps/docs/build ./apps/docs/build

WORKDIR /app/apps/docs

EXPOSE 3000
ENV PORT=3000
CMD ["bun", "./build/index.js"]
