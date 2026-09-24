# Graph Report - startup_council  (2026-09-24)

## Corpus Check
- 50 files · ~11,211 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: (none) 13, .tsbuildinfo 2, .lock 1)

## Summary
- 369 nodes · 526 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `70c2a1b2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- NewSessionView.vue
- settings.ts
- judge.ts
- backend/package.json
- modelRouter.ts
- package.json
- frontend/package.json
- SettingsView.vue
- SessionResultsView.vue
- compilerOptions
- compilerOptions
- backend
- compilerOptions
- dependencies
- Backend (Express + TypeScript)
- #app mount point
- vite-env.d.ts
- frontend/tsconfig.json
- Vercel Services deployment

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 14 edges
2. `compilerOptions` - 13 edges
3. `ModelCallError` - 11 edges
4. `Provider` - 9 edges
5. `callOpenAICompatible()` - 8 edges
6. `judgePersona()` - 8 edges
7. `runChairmanSynthesis()` - 8 edges
8. `callModel()` - 8 edges
9. `compilerOptions` - 8 edges
10. `requireAuth()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `PersonaConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/config/personas.ts → backend/src/types.ts
- `loadUserModelSettings()` --calls--> `decryptSecret()`  [EXTRACTED]
  backend/src/services/loadUserModelSettings.ts → backend/src/services/crypto.ts
- `judgePersona()` --calls--> `callModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `runChairmanSynthesis()` --calls--> `callModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `callModel()` --calls--> `callOpenAICompatible()`  [EXTRACTED]
  backend/src/services/modelRouter.ts → backend/src/services/openaiCompatible.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Council judging flow** — readme_stage1_personas, readme_stage2_chairman, readme_supabase [EXTRACTED 1.00]

## Communities (20 total, 3 thin omitted)

### Community 0 - "NewSessionView.vue"
Cohesion: 0.06
Nodes (33): auth, router, api, supabase, app, router, useAuthStore, ChairmanVerdict (+25 more)

### Community 1 - "settings.ts"
Cohesion: 0.08
Nodes (30): app, missing, requiredEnvVars, AuthedRequest, requireAuth(), judgeRouter, sessionsRouter, PROVIDERS (+22 more)

### Community 2 - "judge.ts"
Cohesion: 0.12
Nodes (31): apiKeyFor(), CHAIRMAN_DEFAULTS, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_SYSTEM_PROMPT, defaultModelFor(), PersonaConfig, PERSONAS, ProviderDefault (+23 more)

### Community 3 - "backend/package.json"
Cohesion: 0.06
Nodes (33): devDependencies, esbuild, tsx, @types/cors, @types/express, @types/multer, @types/node, @types/pdf-parse (+25 more)

### Community 4 - "modelRouter.ts"
Cohesion: 0.12
Nodes (27): callGemini(), GeminiResponse, RETRY_DELAYS_MS, sleep(), ModelCallError, backend_src_services_modelerror_provider, callModel(), ModelTarget (+19 more)

### Community 5 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+18 more)

### Community 6 - "frontend/package.json"
Cohesion: 0.08
Nodes (24): dependencies, pinia, @supabase/supabase-js, vue, vue-router, devDependencies, typescript, vite (+16 more)

### Community 7 - "SettingsView.vue"
Cohesion: 0.10
Nodes (18): error, geminiApiKey, gonkaApiKey, groqApiKey, hasGeminiKey, hasGonkaKey, hasGroqKey, hasMistralKey (+10 more)

### Community 8 - "SessionResultsView.vue"
Cohesion: 0.11
Nodes (15): allPersonasComplete, chairmanError, chairmanStatus, personaLabels, personaVerdicts, props, recommendationColor, retryChairman() (+7 more)

### Community 9 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir (+7 more)

### Community 10 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 11 - "backend"
Cohesion: 0.14
Nodes (13): includeFiles, maxDuration, entrypoint, functions, root, framework, rewrites, root (+5 more)

### Community 12 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 13 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+1 more)

### Community 14 - "Backend (Express + TypeScript)"
Cohesion: 0.33
Nodes (7): Backend (Express + TypeScript), Shared .env configuration, Frontend (Vue 3 + Vite + Pinia), OpenRouter free models, Startup Council, Supabase (Postgres, RLS, magic-link auth), 2-stage council design

### Community 15 - "#app mount point"
Cohesion: 1.00
Nodes (3): #app mount point, Startup Council index.html, src/main.ts entry module

### Community 18 - "Vercel Services deployment"
Cohesion: 0.67
Nodes (3): Asynchronous judging (202 + waitUntil + polling), Supabase setup after deploying, Vercel Services deployment

## Knowledge Gaps
- **206 isolated node(s):** `ProviderConfig`, `ChatResponse`, `RETRY_DELAYS_MS`, `nextSlotAt`, `ChairmanVerdict` (+201 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 230 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pinia` connect `NewSessionView.vue` to `frontend/package.json`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `vue` connect `NewSessionView.vue` to `SessionResultsView.vue`, `frontend/package.json`, `SettingsView.vue`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `ProviderConfig`, `ChatResponse`, `RETRY_DELAYS_MS` to the rest of the system?**
  _206 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `NewSessionView.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._
- **Should `settings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08205128205128205 - nodes in this community are weakly interconnected._
- **Should `judge.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12012012012012012 - nodes in this community are weakly interconnected._
- **Should `backend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._