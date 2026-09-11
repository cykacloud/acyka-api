# The kit's fonts live in the host application

`@cyka/ui/fonts.css` declares its faces against `/fonts/*.woff2`, which is an
address on **this** site rather than a file inside the package — so a host that
does not carry them gets four `@font-face` rules pointing at 404s, falls back to
whatever the system has, and looks almost right in a way nobody reports.

They are copied rather than fetched, because a documentation site that cannot be
built without reaching a private repository at build time is a documentation site
that stops building the day that repository moves. The same files are in
`apps/web/static/fonts` in `acyka/acyka`; if the kit changes a face, both
copies move together.
