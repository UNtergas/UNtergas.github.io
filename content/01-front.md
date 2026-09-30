---
title: [Nguyen, Anh Tuan]
role: Full-stack engineer — TypeScript, Node, React
contact: true
# stamp: [Available, Nov 2026, Paris]     # uncomment for the round mark
# stampTip: Contract ends October 2026.
sign: Turn the page for projects and skills.
---

## About {text}

Security and information technology engineer. Since 2025 on a {{ZTNA|Zero-trust network access: every request is authenticated and authorised, nothing is trusted for being inside the network.}} SaaS platform in TypeScript and Node.js, autonomous and in direct contact with the CTO.

Backend and platform work: identity federation with Keycloak and Entra ID, {{RBAC|Role-based access control: permissions attach to roles, roles attach to users and devices.}}, and OpenAPI contracts consumed by the mobile, SDK and C++ network teams. Took the central console from prototype to a self-hostable product, shipped to production.

## Experience

### Full-stack engineer | 05/2026 — present
Snowpack, ZTNA platform — Paris

- API latency down 3–6× (average, p50, p99) under {{k6|Load-testing tool. Same scenario replayed before and after, so the numbers are comparable.}} load. Most of the gain came from upgrading to Node 24, which the old setup blocked: the backend ran through uncompiled ts-node, so I resolved its cyclic dependencies and migrated it to compiled ESM modules first.
- Production incident closed: CPU spiking 40–70% every ten minutes, traced in Grafana to a {{gzip bomb|A tiny compressed payload that expands to gigabytes, exhausting CPU and memory on decompression.}}. Capped decompression size, restricted the API to JSON, reworked the cron jobs. Back to 10–20%.
- Central console shipped self-hostable: validated on Docker and a Raspberry Pi, packaged as an esbuild bundle and a {{single executable|Node SEA bundles runtime and app into one binary, so customers install nothing.}}, with customer docs and a setup script.
- GitLab CI split into SaaS and customer-build pipelines. Every push runs the Vitest suite, end-to-end tests included, against a containerised MongoDB.
- {{Audit log|Who did what, when, on which tenant. Stored in MongoDB for later review.}} for the console: authentication (success and failure) and tenant operations (create, read, update, delete) recorded from every endpoint, written asynchronously through the task queue I built during the internship.
- Fixed {{TOCTOU|Time-of-check to time-of-use: two requests both pass the check before either writes. Uniqueness has to be enforced where the write happens.}} races on create and update paths by replacing application read-then-write checks with MongoDB unique indexes.

### Full-stack developer, internship | 02/2025 — 03/2026
Snowpack, ZTNA platform — Paris

- Group management, idea to production in two months: the CTO's starting point was one line (group users and devices, members share one config); I wrote the spec and built it. Services and licences propagate to members automatically and are recomputed on any membership or policy change.
- Identity federation with Keycloak and Microsoft Entra ID through {{one shared SSO flow|Both providers use the same login flow and callback; only their configuration differs.}}. Users and group memberships are synced into the console on every SSO login.
- Typed task queue: event types checked at compile time, one dispatcher per queue, async and sync modes. Another developer picked it up with no help, and it later carried the console's audit log.
- Central console as the single entry point for every Snowpack component, with OpenAPI contracts consumed by the mobile, SDK and C++ network teams.
- React load time cut 4× under 2G throttling by removing fetches duplicated across contexts, adding caching, and narrowing queries.
