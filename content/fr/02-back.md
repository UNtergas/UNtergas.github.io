---
title: ["Activités & compétences"]
role: Ce que je construis quand personne ne le demande
sign: Appuyez sur P pour imprimer cette feuille.
---

## Projets {#projects}

### Évaluateur de propositions (RFP) | 09/2026
Hackathon 24 h, Francfort : responsable architecture, équipe de quatre

- Un relecteur IA de propositions commerciales. J'ai conçu le flux : des règles simples dans le code repèrent les montants, les dates et les formulations vagues ; le modèle (Gemini Flash) ne fait que ce que les règles ne peuvent pas faire, noter sept critères par rapport à la demande du client.
- Chaque note doit citer la proposition, et le code vérifie que chaque citation existe vraiment ({{correspondance approximative|Une correspondance quasi exacte est gardée et signalée, tout le reste est écarté. Cela protège la citation, pas le jugement.}}).
- Testé sur dix vraies offres publiques de l'État du Michigan, avec les décisions d'attribution de l'État comme corrigé : même classement sur {{deux marchés sur trois|Le troisième avait des centaines d'exigences, plus qu'une seule lecture ne peut couvrir, et l'offre gagnante était une image scannée.}}, moins de 0,60 $ par offre.
- Python (FastAPI), React. Code : [github.com/UNtergas/SiviHack-2026-Team](https://github.com/UNtergas/SiviHack-2026-Team)

### Journal d'apprentissage | 12/2024 - 02/2025
INSA Centre Val de Loire : projet de 5e année, prévu pour 2-3, fait seul

- Une application web pour suivre un apprentissage, avec trois rôles : l'entreprise assigne des missions, l'apprenti note ses activités et évalue ses compétences (avec un graphique), le tuteur INSA l'évalue, et les deux donnent leur avis.
- Backend NestJS : connexion par JWT en cookie, {{guards|Décorateurs personnalisés et guards Nest qui vérifient le rôle de l'utilisateur avant l'exécution d'un endpoint.}} qui restreignent les endpoints par rôle, Prisma et PostgreSQL. Frontend Next.js, avec un middleware qui bloque les pages au-dessus du rôle de l'utilisateur.
- Monorepo pnpm avec un paquet de modèles partagé, Docker et un reverse proxy Nginx.

### Appius, jeu de city-builder | 10/2022 - 01/2023
INSA Centre Val de Loire : projet d'école, équipe de six

- J'ai réparti les tâches et laissé à chacun le temps de contribuer. Trois semaines avant l'échéance, j'ai repris la suite en main et écrit {{environ les trois quarts du code|2 598 des quelque 3 413 lignes de la version finale, d'après git blame.}}.
- {{Moteur du jeu principal|La boucle de la scène de jeu (mise à jour, affichage et saisie à chaque image), le monde, la caméra et les bâtiments. Les menus et le passage d'un écran à l'autre étaient le travail d'un coéquipier.}} : le système d'événements en jeu (calendrier, vitesse de jeu, risque d'incendie et incendies, logement, marcheurs, patrouilles de préfets, eau, évolution des maisons), pathfinding A* pour les routes et les marcheurs, immigrants qui trouvent une parcelle et s'installent, préfecture, ingénieur et puits, risque d'incendie et couches d'eau.
- Moteur, optimisé pour le FPS : {{carte pré-rendue une fois|Le sol est dessiné une seule fois dans une image en cache ; chaque image affiche ce cache à la position de la caméra au lieu de redessiner chaque case. Poser un bâtiment ne redessine que sa case dans le cache.}}, seules les cases modifiées redessinées, en 4 couches (sol, marcheurs, bâtiments, aperçu de construction) ; caméra et minicarte, animations, vitesse de jeu. Python. Code : [github.com/jumscrafteur/appius](https://github.com/jumscrafteur/appius/tree/legacy)

## Formation {#education}

### Diplôme d'ingénieur, sécurité et technologies informatiques | 2020 - 2026
INSA Centre Val de Loire

- Bourges, 2022-2026. Cycle préparatoire intégré franco-vietnamien sélectif à Huế, 2020-2022.

## Compétences {grid #skills}

- Langages: TypeScript, JavaScript, Python, SQL
- Backend: Node.js, Express, TSOA, NestJS, REST, OpenAPI, FastAPI
- Frontend: React, Next.js, Vite
- Données: MongoDB, TypeORM, PostgreSQL, Prisma, SQL
- Sécurité: authentification, RBAC, sécurité applicative, Keycloak, Microsoft Entra ID
- Tests: Vitest (TDD, end-to-end), tests de charge k6
- Build: Docker, GitLab CI, ESM, swc, esbuild, Node SEA, Grafana
- Système: Linux (au quotidien : niri, Hyprland), Bash, Git
- IA: Claude Code (code à partir de mes specs, relu au diff)
- Langues: anglais C1 (TOEIC 970/990), français B2 (DELF B2, 72,5/100), vietnamien langue maternelle

## Intérêts {grid #interest}
- Systèmes & simulation: base Notion relationnelle pour des ligues esport : classements automatiques, pages joueur/équipe/nation liées
- Escalade de bloc: dyno et dalle
- Philosophie: existentialisme, éthique
- Musique: du jazz au RnB et à la pop, et j'aime la guitare
