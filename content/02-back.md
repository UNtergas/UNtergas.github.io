---
title: [Activities, "& skills"]
role: What I build when nobody assigns it
sign: Press P to print this sheet.
---

## Projects

### RFP proposal scorer | 09/2026
24-hour hackathon, Frankfurt: architecture lead, team of four

- An AI reviewer for sales proposals. I designed the flow: simple rules in code catch amounts, dates and vague wording; the model (Gemini Flash) only does what rules can't, scoring seven criteria against the client's request.
- Every score must quote the proposal, and code checks that each quote really exists ({{fuzzy match|A near-exact match is kept and flagged, anything else is dropped. It guards the quote, not the judgment.}}).
- Tested on ten real public bids from the State of Michigan, with the State's own award decisions as the answer key: same ranking on {{two of three contracts|The third had hundreds of requirements, more than one read could cover, and the winning bid was a scanned image.}}, under $0.60 per bid.
- Python (FastAPI), React. Code: [github.com/UNtergas/SiviHack-2026-Team](https://github.com/UNtergas/SiviHack-2026-Team)

### Apprenticeship diary | 12/2024 - 02/2025
INSA Centre Val de Loire: 5th-year school project, planned for 2-3, done alone

- A web app to follow an apprenticeship, with three roles: the company assigns missions, the apprentice logs activities and rates their own skills (with a chart), the INSA tutor evaluates them, and both give feedback.
- NestJS backend: sign-in with a JWT in a cookie, {{guards|Custom decorators and Nest guards check the user's role before an endpoint runs.}} that restrict endpoints by role, Prisma and PostgreSQL. Next.js frontend, with a middleware that blocks pages above the user's role.
- pnpm monorepo with a shared models package, Docker and an Nginx reverse proxy.

## Education

### Engineering degree, security and information technology | 2020 - 2026
INSA Centre Val de Loire

- Bourges, 2022-2026. Selective Franco-Vietnamese integrated preparatory programme in Huế, 2020-2022.

## Skills {grid}

- Languages: TypeScript, JavaScript, Python, SQL, Java (academic)
- Backend: Node.js, Express, TSOA, NestJS, REST, OpenAPI, FastAPI
- Frontend: React, Next.js, Vite
- Data: MongoDB, TypeORM, PostgreSQL, Prisma, SQL
- Security: Authentication, RBAC, application security, Keycloak, Microsoft Entra ID
- Testing: Vitest (TDD, end-to-end), k6 load testing
- Build: Docker, GitLab CI, ESM, swc, esbuild, Node SEA, Grafana
- AI: Claude Code (code from my specs, reviewed by diff)

## Spoken {text}

English, French, Vietnamese.

## Interest {grid}
- Systems & simulation: relational Notion base for esports leagues>>auto-ranking formulas, linked player/team/nation pages
- Bouldering: dyno and slab
- Philosophy: existentialism, ethics
- Music: jazz to RnB to Pop, and I like guitar
