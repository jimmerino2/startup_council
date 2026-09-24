# Graph Report - startup_council  (2026-09-24)

## Corpus Check
- Corpus is ~6,466 words - fits in a single context window. You may not need a graph.

## Summary
- 269 nodes · 354 edges · 16 communities (14 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Council Personas & Models
- Express API & Auth
- Frontend API & Stores
- Backend Dev Tooling
- Frontend Dependencies
- Vue App & Supabase Client
- Backend TS Config
- Frontend TS App Config
- Architecture & Judging Concepts
- Vercel Services Config
- Node TS Config
- Root Scripts
- Backend Dependencies
- HTML Entry Point
- Vite Env Types
- Frontend TS References

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 14 edges
2. `compilerOptions` - 13 edges
3. `compilerOptions` - 8 edges
4. `express` - 6 edges
5. `requireAuth()` - 6 edges
6. `judgeWithPersona()` - 6 edges
7. `runCouncil()` - 6 edges
8. `runChairman()` - 6 edges
9. `callModel()` - 6 edges
10. `vue` - 6 edges

## Surprising Connections (you probably didn't know these)
- `judgeInBackground()` --calls--> `runCouncil()`  [EXTRACTED]
  backend/src/routes/judge.ts → backend/src/services/council.ts
- `PersonaConfig` --references--> `PersonaKey`  [EXTRACTED]
  backend/src/config/personas.ts → backend/src/types.ts
- `judgeWithPersona()` --calls--> `resolveModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/config/personas.ts
- `runChairman()` --calls--> `resolveChairmanModels()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/config/personas.ts
- `requireAuth()` --calls--> `createAnonClient()`  [EXTRACTED]
  backend/src/middleware/requireAuth.ts → backend/src/supabase/client.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Council judging flow** — readme_file_upload_parsing, readme_stage1_personas, readme_stage2_chairman [EXTRACTED 0.95]

## Communities (16 total, 2 thin omitted)

### Community 0 - "Council Personas & Models"
Cohesion: 0.11
Nodes (28): CHAIRMAN_DEFAULT_MODEL, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_MODEL_ENV_VAR, CHAIRMAN_SYSTEM_PROMPT, PersonaConfig, PERSONAS, resolveChairmanModels(), resolveModel() (+20 more)

### Community 1 - "Express API & Auth"
Cohesion: 0.11
Nodes (23): app, missing, requiredEnvVars, AuthedRequest, requireAuth(), judgeRouter, SessionRow, sessionsRouter (+15 more)

### Community 2 - "Frontend API & Stores"
Cohesion: 0.08
Nodes (21): api, ChairmanVerdict, PersonaVerdict, SessionSummary, useSessionsStore, error, judgingCriteria, pitchText (+13 more)

### Community 3 - "Backend Dev Tooling"
Cohesion: 0.07
Nodes (26): devDependencies, tsx, @types/cors, @types/express, @types/multer, @types/node, @types/pdf-parse, typescript (+18 more)

### Community 4 - "Frontend Dependencies"
Cohesion: 0.08
Nodes (24): dependencies, pinia, @supabase/supabase-js, vue, vue-router, devDependencies, typescript, vite (+16 more)

### Community 5 - "Vue App & Supabase Client"
Cohesion: 0.12
Nodes (17): auth, router, supabase, app, router, useAuthStore, frontend_src_style, auth (+9 more)

### Community 6 - "Backend TS Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir (+7 more)

### Community 7 - "Frontend TS App Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 8 - "Architecture & Judging Concepts"
Cohesion: 0.24
Nodes (13): Asynchronous Judging, Backend (Express API), sessions, persona_verdicts, chairman_verdicts tables, Shared .env Configuration, Pitch Upload and Parsing, Frontend (Vue 3, Vite, Pinia), OpenRouter Free Models, Stage 1 Persona Scoring (+5 more)

### Community 9 - "Vercel Services Config"
Cohesion: 0.15
Nodes (12): maxDuration, entrypoint, functions, root, framework, rewrites, root, api/index.ts (+4 more)

### Community 10 - "Node TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 11 - "Root Scripts"
Cohesion: 0.20
Nodes (9): devDependencies, concurrently, supabase, private, scripts, dev, install:all, concurrently (+1 more)

### Community 12 - "Backend Dependencies"
Cohesion: 0.22
Nodes (9): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+1 more)

### Community 13 - "HTML Entry Point"
Cohesion: 1.00
Nodes (3): #app mount point, Startup Council index.html, src/main.ts entry module

## Knowledge Gaps
- **147 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+142 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 159 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pinia` connect `Vue App & Supabase Client` to `Frontend API & Stores`, `Frontend Dependencies`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `express` connect `Express API & Auth` to `Backend Dev Tooling`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `@vercel/functions` connect `Express API & Auth` to `Backend Dev Tooling`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _147 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Council Personas & Models` be split into smaller, more focused modules?**
  _Cohesion score 0.11174242424242424 - nodes in this community are weakly interconnected._
- **Should `Express API & Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._
- **Should `Frontend API & Stores` be split into smaller, more focused modules?**
  _Cohesion score 0.07526881720430108 - nodes in this community are weakly interconnected._