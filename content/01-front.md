---
title: [Nguyen Anh Tuan]
role: Full-stack engineer: TypeScript, Node, React
contact: true
# stamp: [Available, Nov 2026, Paris]     # uncomment for the round mark
# stampTip: Contract ends October 2026.
sign: Turn the page for projects and skills.
---

## About {text}

Computer science and security engineer. Since 2025, full-stack TypeScript/Node.js developer on the central console of a {{ZTNA|Zero-trust network access: every request is authenticated and authorised, nothing is trusted for being inside the network.}} platform, the system our apps and our network depend on. Two developers, no tech lead, working directly with the CTO: I take features from spec to production on my own. I also go after problems nobody assigned: I found why our backend started slowly, wrote the case for the CTO, then did the Node.js upgrade.

## Experience

### Full-stack engineer, fixed-term contract | 05/2026 - present
Snowpack, ZTNA platform, Paris

- **Production incident.** The console's CPU spiked every ten minutes. I traced it in Grafana to two causes: background jobs {{piling up|A timer that doesn't wait for the previous async run: when the server slowed, runs overlapped and added more load.}} and one client device sending ever-larger reports. Same day, a {{reversible stopgap|For the weekend, the heavy calculation on device reports was skipped but the raw data kept; on Monday I recalculated it.}} that kept the raw data; then both fixes: jobs skip a run while the previous one is still going, and a 2 MB report limit {{from real data|Every stored report over the last three months was under 1 MB, so the limit is twice that.}}. CPU from {{100% at peak to 10-20% at most|CPU: before █▁▁█▁▁█▁▁█▁▁█ a spike every 10 min → after ▂▁▂▁▁▂▁▂▁▁▂▁ 10-20% max}} since.
- **Node.js upgrade (18 → 24).** Moved the backend off an unsupported version and {{pre-compiled it|The code used to be translated on the fly at every start. It is now compiled ahead of time, which also type-checks it.}}, after untangling shared packages that depended on each other. {{Start-up 2.5 → 1.5 min|start-up time: before ██████████ 2.5 min → after ██████ 1.5 min}}, every CI pipeline 1-1.5 min faster, deployed image 30% smaller, about 40 hidden type errors surfaced.
- **Partner app identity (Android SDK).** Companies plug their own Android apps into ours, and each app should reach only the services it needs. I designed how our app tells which app is calling: it asks the phone's operating system, which {{checks each app's signature|Package name plus signing certificate, recorded by Android at install. Knowing the certificate doesn't let you forge the signature.}}. The {{allowed list|The console sends it each time an app connects. The saved copy is used only when the console can't be reached, and expires with the user's login, at most ten days.}} is kept on the phone so field devices keep working offline.
- **Self-hostable console.** For a prospective client who wanted our platform offline on their own machines: {{trimmed the console|Removed what an offline client can't use: payments, referrals, catalog plans.}} to what works offline (about 6,000 lines removed) and packaged it as {{one executable plus its dependencies|Node SEA: the Node runtime and our minified code in one binary; third-party packages ship next to it.}}, for standard and ARM machines, tested on a Raspberry Pi. Four colleagues installed it alone from my guide in 30-40 minutes, and our dev team set up the internal testing pipeline with it. The prospective client is now testing it and found the guide easy to follow.
- **Release testing.** Manual beta rounds across seven platforms, with small tools I wrote so anyone on the team can replay edge cases. They caught a bug nobody had spotted, before it reached a release.
- **Audit log.** Records sign-ins (success and failure) and the actions taken in each company's space, written in the background through the task queue.

### Full-stack developer, internship | 02/2025 - 03/2026
Snowpack, ZTNA platform, Paris

- **Devices, seven weeks after joining.** Added IoT devices as a new kind of account that signs in with a token instead of a password, with its own access control, backend and frontend.
- **Group-based access, in under two months.** Access used to be granted one user at a time. From the CTO's idea, I wrote the spec, {{left licences for later|Licences have their own expiry and ranked tiers. The client only needed bulk access first.}}, and built it end to end: bulk assignment of users to services, {{inherited access|Each member's group access is its own record linked to the group's, so removing one never deletes the other. When direct and group access overlap, the more generous wins: both come from the same company owner.}}, a change log, 26 tests. Live July 2025; later extended to licences and devices without changing the model.
- **Identity-provider sync** with Keycloak and Microsoft Entra ID: each company's groups and members copied every five minutes and at sign-in. The provider is the source of truth, so someone removed there loses the access that came with the group. Closed an {{SSRF|Server-side request forgery: a company types in its Keycloak address, so our server could have been pointed at our own internal network. Internal addresses are now refused.}} hole.
- **Typed task queue.** After a review where my licence logic was hard to follow and hid a double-licence bug, I moved it to one central place and a queue that applies the main licence changes one at a time, replacing {{a lock that had failed|It locked per group while all of a company's groups share one licence pool, and the free licence was looked up before taking the lock. The queue checks and assigns in one step.}}. Misuse is a compile error. Twelve queues today, reused by another developer without help.
- **Faster data loading on every console page.** The server answered in 200-400 ms, so the problem was the page: every page called one shared "reload everything", about eleven requests. Now each page asks only for what it shows, with {{a short cache|Data is remembered for 60 seconds and always fetched fresh after any change, so an admin never sees outdated data after editing.}} refreshed after any change. {{Users page 10-15 s → 4-5 s|users page load: before ████████████ 10-15 s → after █████ 4-5 s}}, 2-3×.
- **Data usage tracking.** Daily data usage per user, device and partner, built from the raw usage logs, with the admin charts to read it. A one-off migration {{rebuilt the history|It read the past logs in batches of 1,000, so the existing history showed up in the new view without loading everything into memory.}} from the past logs.
