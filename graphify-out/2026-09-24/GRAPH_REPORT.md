# Graph Report - startup_council  (2026-09-24)

## Corpus Check
- Corpus is ~11,211 words - fits in a single context window. You may not need a graph.

## Summary
- 369 nodes · 527 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend App & API Client
- Backend Server & Routes
- Personas & Model Defaults
- Backend Dev Dependencies
- Gemini & Model Errors
- Root Dependencies
- Session Results View
- Settings View & Keys
- Results Polling State
- Backend TS Config
- Frontend TS Config
- Vercel Config
- Frontend Node Config
- Backend Dependencies
- README & Deployment
- index.html Shell
- Vite Env Types
- Frontend TS References
- Async Judging & Vercel Docs

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 14 edges
2. `compilerOptions` - 13 edges
3. `ModelCallError` - 11 edges
4. `Provider` - 10 edges
5. `judgePersona()` - 8 edges
6. `runChairmanSynthesis()` - 8 edges
7. `callModel()` - 8 edges
8. `callOpenAICompatible()` - 8 edges
9. `compilerOptions` - 8 edges
10. `resolveModelTarget()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `PersonaConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/config/personas.ts → backend/src/types.ts
- `judgePersona()` --calls--> `callModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `runChairmanSynthesis()` --calls--> `callModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `loadUserModelSettings()` --calls--> `decryptSecret()`  [EXTRACTED]
  backend/src/services/loadUserModelSettings.ts → backend/src/services/crypto.ts
- `ProviderConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/services/openaiCompatible.ts → backend/src/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Council judging flow** — readme_stage1_personas, readme_stage2_chairman, readme_supabase [EXTRACTED 1.00]

## Communities (20 total, 3 thin omitted)

### Community 0 - "Frontend App & API Client"
Cohesion: 0.06
Nodes (33): auth, router, api, supabase, app, router, useAuthStore, ChairmanVerdict (+25 more)

### Community 1 - "Backend Server & Routes"
Cohesion: 0.08
Nodes (30): app, missing, requiredEnvVars, AuthedRequest, requireAuth(), judgeRouter, sessionsRouter, PROVIDERS (+22 more)

### Community 2 - "Personas & Model Defaults"
Cohesion: 0.12
Nodes (31): apiKeyFor(), CHAIRMAN_DEFAULTS, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_SYSTEM_PROMPT, defaultModelFor(), PersonaConfig, PERSONAS, ProviderDefault (+23 more)

### Community 3 - "Backend Dev Dependencies"
Cohesion: 0.06
Nodes (33): devDependencies, esbuild, tsx, @types/cors, @types/express, @types/multer, @types/node, @types/pdf-parse (+25 more)

### Community 4 - "Gemini & Model Errors"
Cohesion: 0.12
Nodes (27): callGemini(), GeminiResponse, RETRY_DELAYS_MS, sleep(), ModelCallError, backend_src_services_modelerror_provider, callModel(), ModelTarget (+19 more)

### Community 5 - "Root Dependencies"
Cohesion: 0.07
Nodes (26): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+18 more)

### Community 6 - "Session Results View"
Cohesion: 0.08
Nodes (24): dependencies, pinia, @supabase/supabase-js, vue, vue-router, devDependencies, typescript, vite (+16 more)

### Community 7 - "Settings View & Keys"
Cohesion: 0.10
Nodes (18): error, geminiApiKey, gonkaApiKey, groqApiKey, hasGeminiKey, hasGonkaKey, hasGroqKey, hasMistralKey (+10 more)

### Community 8 - "Results Polling State"
Cohesion: 0.11
Nodes (15): allPersonasComplete, chairmanError, chairmanStatus, personaLabels, personaVerdicts, props, recommendationColor, retryChairman() (+7 more)

### Community 9 - "Backend TS Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir (+7 more)

### Community 10 - "Frontend TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 11 - "Vercel Config"
Cohesion: 0.14
Nodes (13): includeFiles, maxDuration, entrypoint, functions, root, framework, rewrites, root (+5 more)

### Community 12 - "Frontend Node Config"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 13 - "Backend Dependencies"
Cohesion: 0.22
Nodes (9): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+1 more)

### Community 14 - "README & Deployment"
Cohesion: 0.33
Nodes (7): Backend (Express + TypeScript), Shared .env configuration, Frontend (Vue 3 + Vite + Pinia), OpenRouter free models, Startup Council, Supabase (Postgres, RLS, magic-link auth), 2-stage council design

### Community 15 - "index.html Shell"
Cohesion: 1.00
Nodes (3): #app mount point, Startup Council index.html, src/main.ts entry module

### Community 18 - "Async Judging & Vercel Docs"
Cohesion: 0.67
Nodes (3): Asynchronous judging (202 + waitUntil + polling), Supabase setup after deploying, Vercel Services deployment

## Knowledge Gaps
- **205 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+200 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 229 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pinia` connect `Frontend App & API Client` to `Session Results View`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `vue` connect `Frontend App & API Client` to `Results Polling State`, `Session Results View`, `Settings View & Keys`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _205 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend App & API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._
- **Should `Backend Server & Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.08205128205128205 - nodes in this community are weakly interconnected._
- **Should `Personas & Model Defaults` be split into smaller, more focused modules?**
  _Cohesion score 0.12012012012012012 - nodes in this community are weakly interconnected._
- **Should `Backend Dev Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._