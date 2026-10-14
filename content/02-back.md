---
title: [Activities, "& skills"]
role: What I build when nobody assigns it
sign: Press P to print this sheet.
---

## Events

### RFP proposal scorer | 09/2026
24-hour hackathon, Frankfurt — architecture lead, team of four

- An AI reviewer for sales proposals. I designed the flow: simple rules in code catch amounts, dates and vague wording; the model (Gemini Flash) only does what rules can't, scoring seven criteria against the client's request.
- Every score must quote the proposal, and code checks that each quote really exists ({{fuzzy match|A near-exact match is kept and flagged, anything else is dropped. It guards the quote, not the judgment.}}).
- Tested on ten real public bids from the State of Michigan, with the State's own award decisions as the answer key: same ranking on {{two of three contracts|The third had hundreds of requirements, more than one read could cover, and the winning bid was a scanned image.}}, under $0.60 per bid. 5th place.
- Python (FastAPI), React. Code: [github.com/UNtergas/SiviHack-2026-Team](https://github.com/UNtergas/SiviHack-2026-Team)

## Education

### Engineering degree, security and information technology | 2020 — 2026
INSA Centre Val de Loire

- Bourges, 2022–2026. Selective Franco-Vietnamese integrated preparatory programme in Huế, 2020–2022.

## Skills {grid}

- Languages: TypeScript, JavaScript, Python, SQL, Java (academic)
- Backend: Node.js, Express, TSOA, REST, OpenAPI, FastAPI
- Frontend: React, Next.js, Vite
- Data: MongoDB, TypeORM, SQL
- Security: Authentication, RBAC, application security, Keycloak, Microsoft Entra ID
- Testing: Vitest (TDD, end-to-end), k6 load testing
- Build: Docker, GitLab CI, ESM, swc, esbuild, Node SEA, Grafana

## Spoken {grid}

- English: C1, TOEIC 970
- French: B2, DELF 72.5
- Vietnamese: Native

## Interest {grid}
- Systems & simulation: relational Notion base for sports leagues>>auto-ranking formulas, linked player/team/nation pages
- Bouldering: dyno and slab
- Philosophy: existentialism, ethics
- Music: jazz to RnB to Pop, and I like guitar
