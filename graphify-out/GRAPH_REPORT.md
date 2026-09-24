# Graph Report - startup_council  (2026-09-24)

## Corpus Check
- Corpus is ~11,125 words - fits in a single context window. You may not need a graph.

## Summary
- 345 nodes · 511 edges · 24 communities (22 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Persona & Model Config
- Backend Entry & Auth
- Backend Dependencies
- Gemini Client & Errors
- Frontend Dependencies
- Settings Page
- Session Results View
- Backend TS Config
- Frontend TS Config
- New Session Form
- Vercel Deploy Config
- App Shell & Routing
- Sessions Store
- Node TS Config
- Root Scripts
- Backend Dev Deps
- API Client & Supabase
- Auth View
- README Architecture
- Secret Encryption
- index.html Entry
- Vite Env Types
- Frontend TS Refs
- Async Judging & Deploy

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
10. `express` - 7 edges

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

## Communities (24 total, 2 thin omitted)

### Community 0 - "Persona & Model Config"
Cohesion: 0.12
Nodes (31): apiKeyFor(), CHAIRMAN_DEFAULTS, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_SYSTEM_PROMPT, defaultModelFor(), PersonaConfig, PERSONAS, ProviderDefault (+23 more)

### Community 1 - "Backend Entry & Auth"
Cohesion: 0.10
Nodes (25): app, missing, requiredEnvVars, AuthedRequest, requireAuth(), judgeRouter, sessionsRouter, PROVIDERS (+17 more)

### Community 2 - "Backend Dependencies"
Cohesion: 0.06
Nodes (30): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+22 more)

### Community 3 - "Gemini Client & Errors"
Cohesion: 0.13
Nodes (26): callGemini(), GeminiResponse, RETRY_DELAYS_MS, sleep(), ModelCallError, backend_src_services_modelerror_provider, callModel(), ModelTarget (+18 more)

### Community 4 - "Frontend Dependencies"
Cohesion: 0.08
Nodes (24): dependencies, pinia, @supabase/supabase-js, vue, vue-router, devDependencies, typescript, vite (+16 more)

### Community 5 - "Settings Page"
Cohesion: 0.10
Nodes (18): error, geminiApiKey, gonkaApiKey, groqApiKey, hasGeminiKey, hasGonkaKey, hasGroqKey, hasMistralKey (+10 more)

### Community 6 - "Session Results View"
Cohesion: 0.11
Nodes (15): allPersonasComplete, chairmanError, chairmanStatus, personaLabels, personaVerdicts, props, recommendationColor, retryChairman() (+7 more)

### Community 7 - "Backend TS Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir (+7 more)

### Community 8 - "Frontend TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 9 - "New Session Form"
Cohesion: 0.15
Nodes (10): error, judgingCriteria, pitchText, problemStatement, router, sourceFiles, store, submitting (+2 more)

### Community 10 - "Vercel Deploy Config"
Cohesion: 0.15
Nodes (12): maxDuration, entrypoint, functions, root, framework, rewrites, root, api/index.ts (+4 more)

### Community 11 - "App Shell & Routing"
Cohesion: 0.24
Nodes (7): auth, router, app, router, useAuthStore, frontend_src_style, vue-router

### Community 12 - "Sessions Store"
Cohesion: 0.22
Nodes (8): ChairmanVerdict, PersonaVerdict, RoleStatus, SessionSummary, useSessionsStore, store, pinia, vue

### Community 13 - "Node TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 14 - "Root Scripts"
Cohesion: 0.20
Nodes (9): devDependencies, concurrently, supabase, private, scripts, dev, install:all, concurrently (+1 more)

### Community 15 - "Backend Dev Deps"
Cohesion: 0.25
Nodes (8): devDependencies, tsx, @types/cors, @types/express, @types/multer, @types/node, @types/pdf-parse, typescript

### Community 16 - "API Client & Supabase"
Cohesion: 0.36
Nodes (3): api, supabase, ref_supabase_supabase_js

### Community 17 - "Auth View"
Cohesion: 0.29
Nodes (5): auth, email, error, loading, sent

### Community 18 - "README Architecture"
Cohesion: 0.33
Nodes (7): Backend (Express + TypeScript), Shared .env configuration, Frontend (Vue 3 + Vite + Pinia), OpenRouter free models, Startup Council, Supabase (Postgres, RLS, magic-link auth), 2-stage council design

### Community 19 - "Secret Encryption"
Cohesion: 0.60
Nodes (4): decryptSecret(), deriveKey(), encryptSecret(), ref_node_crypto

### Community 20 - "index.html Entry"
Cohesion: 1.00
Nodes (3): #app mount point, Startup Council index.html, src/main.ts entry module

### Community 23 - "Async Judging & Deploy"
Cohesion: 0.67
Nodes (3): Asynchronous judging (202 + waitUntil + polling), Supabase setup after deploying, Vercel Services deployment

## Knowledge Gaps
- **180 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+175 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 199 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `Backend Entry & Auth` to `Persona & Model Config`, `Backend Dependencies`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `pinia` connect `Sessions Store` to `API Client & Supabase`, `App Shell & Routing`, `Frontend Dependencies`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `@vercel/functions` connect `Backend Dependencies` to `Persona & Model Config`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _180 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Persona & Model Config` be split into smaller, more focused modules?**
  _Cohesion score 0.12012012012012012 - nodes in this community are weakly interconnected._
- **Should `Backend Entry & Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.09982174688057041 - nodes in this community are weakly interconnected._
- **Should `Backend Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._