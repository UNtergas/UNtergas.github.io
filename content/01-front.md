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

- API latency down 3–6× at p50, p90 and p99 under {{k6|Load-testing tool. Same scenario replayed before and after, so the numbers are comparable.}} load: the backend ran through ts-node uncompiled, so I resolved the cyclic dependencies blocking it and migrated to compiled ESM modules.
- Production incident closed: CPU spiking 40–70% every ten minutes, traced in Grafana to a {{gzip bomb|A tiny compressed payload that expands to gigabytes, exhausting CPU and memory on decompression.}}. Capped decompression size, restricted the API to JSON, refactored the cronjobs. Back to 10–20%.
- Central console shipped self-hostable: validated on Docker and a Raspberry Pi, packaged as an esbuild bundle and a {{single executable|Node SEA bundles runtime and app into one binary, so customers install nothing.}}, with customer docs and a setup script.
- GitLab CI split into SaaS and customer-build pipelines. Every push runs the Vitest suite, end-to-end tests included, against a containerised MongoDB.
- Fixed a {{TOCTOU|Time-of-check to time-of-use: two requests both pass the check before either writes. Uniqueness has to be enforced where the write happens.}} on the CRUD paths by replacing application read-then-write with MongoDB unique constraints.

### Full-stack developer, internship | 02/2025 — 03/2026
Snowpack, ZTNA platform — Paris

- Group management from a raw CTO requirement to production in two months: polymorphic assignment of users and devices, automatic propagation of services and licences, deterministic recalculation on any membership or policy change.
- Identity federation with Keycloak and Microsoft Entra ID using a {{strategy per provider|One interface, one implementation per IdP. Adding a provider touches no shared code.}}; accounts provisioned on first sign-in, so no sync job to operate.
- Generic typed task queue: compile-time-typed event map, per-queue dispatcher, fire-and-forget and synchronous modes. Another developer picked it up with no help.
- Central console as the single entry point for every Snowpack component, with OpenAPI contracts consumed by the mobile, SDK and C++ network teams.
- React load time cut 4× under 2G throttling by removing refetching duplicated across contexts, caching, and narrowing queries.
