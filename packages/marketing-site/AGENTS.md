# Marketing Site Revamp

`packages/marketing-site` is undergoing a full frontend revamp. Treat this
directory as an isolated design and presentation workspace.

## Scope

- Make changes only within `packages/marketing-site/`.
- You may redesign pages, layouts, components, styles, content presentation,
  and marketing-site assets in this directory.
- Preserve the existing public routes and the behavior of links unless the
  task explicitly asks to change them.

## Do not touch

- Do not edit any file outside `packages/marketing-site/`.
- Do not change backend wiring: APIs, authentication, databases, server
  configuration, environment variables, deployment configuration, or shared
  packages.
- Do not change API endpoints, request/response contracts, redirects, or
  external integration behavior from the marketing site.
- Do not modify root workspace configuration, lockfiles, or dependency
  manifests outside this package for the revamp.

## Working approach

- Prefer local, frontend-only components and styles over cross-package changes.
- Keep the existing Astro project buildable and type-safe.
- Validate changes with the relevant `@metakip/marketing-site` package scripts
  when they are available.
- If the desired work requires a backend or another repository folder to
  change, stop and ask for explicit approval before proceeding.
