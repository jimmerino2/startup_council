# Graph Report - startup_council  (2026-09-26)

## Corpus Check
- 69 files · ~32,820 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: (none) 13, .tsbuildinfo 2, .lock 1)

## Summary
- 610 nodes · 989 edges · 36 communities (32 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `490f76b6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- council.ts
- modelRouter.ts
- router/index.ts
- settings.ts
- backend/package.json
- SessionResultsView.vue
- SettingsView.vue
- package.json
- frontend/package.json
- Backend TS Config
- Startup Council
- compilerOptions
- backend
- fetchDocument.ts
- compilerOptions
- HTML Entry Point
- Vite Env Types
- Frontend TS Config
- NewSessionView.vue
- loadUserModelSettings.ts
- uploadOne
- lengthState
- clearDraftStorage
- isDirty
- addCriterion
- GraphCanvas.vue
- graph.ts
- FileDropZone.vue
- auth.ts
- stores/sessions.ts
- run
- AuthView.vue
- dependencies
- devDependencies
- scripts

## God Nodes (most connected - your core abstractions)
1. `Provider` - 14 edges
2. `ModelCallError` - 14 edges
3. `compilerOptions` - 14 edges
4. `compilerOptions` - 13 edges
5. `runChairmanSynthesis()` - 11 edges
6. `callGemini()` - 11 edges
7. `callModel()` - 11 edges
8. `callOpenRouter()` - 11 edges
9. `resolveModelTarget()` - 9 edges
10. `judgePersona()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `PersonaConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/config/personas.ts → backend/src/types.ts
- `SessionRow` --references--> `PersonaKey`  [EXTRACTED]
  backend/src/routes/judge.ts → backend/src/types.ts
- `findEvidence()` --calls--> `callModelWithSearch()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `ModelTarget` --references--> `Provider`  [EXTRACTED]
  backend/src/services/modelRouter.ts → backend/src/types.ts
- `ProviderConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/services/openaiCompatible.ts → backend/src/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four-step council judging flow** — readme_step1_gather_evidence, readme_step2_initial_verdicts, readme_step3_peer_review, readme_step4_chairman [EXTRACTED 0.95]

## Communities (36 total, 4 thin omitted)

### Community 0 - "council.ts"
Cohesion: 0.07
Nodes (71): CHAIRMAN_DEFAULTS, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_SYSTEM_PROMPT, CLERK_DEFAULT_MODELS, CLERK_FALLBACK_MODELS, CLERK_SYSTEM_PROMPT, defaultModelFor(), EVIDENCE_EXTRACT_SYSTEM_PROMPT (+63 more)

### Community 1 - "modelRouter.ts"
Cohesion: 0.08
Nodes (46): callGemini(), GeminiResponse, RETRY_DELAYS_MS, sleep(), cursor, describeKey(), isUsable(), KeyedTarget (+38 more)

### Community 2 - "router/index.ts"
Cohesion: 0.24
Nodes (8): app, router, useSessionsStore, frontend_src_style, store, pinia, vue, vue-router

### Community 3 - "settings.ts"
Cohesion: 0.07
Nodes (34): CLERK_PROVIDERS, DEFAULT_MAX_EVIDENCE, MAX_EVIDENCE_LIMIT, app, missing, requiredEnvVars, AuthedRequest, requireAuth() (+26 more)

### Community 4 - "backend/package.json"
Cohesion: 0.05
Nodes (42): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+34 more)

### Community 5 - "SessionResultsView.vue"
Cohesion: 0.05
Nodes (37): actionError, allPersonasComplete, allReviewsComplete, anyReviewFailed, anyReviewRunning, averageRanking, busy, chairmanError (+29 more)

### Community 6 - "SettingsView.vue"
Cohesion: 0.07
Nodes (28): addKey(), ALL_ROLES, CLERK, CLERK_PROVIDERS, error, extractEvidence, keyAction(), keyBusy (+20 more)

### Community 7 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+18 more)

### Community 8 - "frontend/package.json"
Cohesion: 0.18
Nodes (10): name, private, type, version, d3-force, @types/d3-force, typescript, vite (+2 more)

### Community 9 - "Backend TS Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir (+7 more)

### Community 10 - "Startup Council"
Cohesion: 0.14
Nodes (16): Cost per judged idea, Six council personas, Evidence clerk model, Evidence request statuses, Document fetch with SSRF protection, Model providers, Multiple API keys and rotation, Project structure (+8 more)

### Community 11 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 12 - "backend"
Cohesion: 0.14
Nodes (13): includeFiles, maxDuration, entrypoint, functions, root, framework, rewrites, root (+5 more)

### Community 13 - "fetchDocument.ts"
Cohesion: 0.26
Nodes (12): assertPublicHost(), decodeEntities(), fetchDocument(), FetchedDocument, htmlToText(), isPrivateIPv4(), isPrivateIPv6(), MAX_RAW_CHARS (+4 more)

### Community 14 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 15 - "HTML Entry Point"
Cohesion: 1.00
Nodes (3): #app mount point, Startup Council index.html, src/main.ts entry module

### Community 19 - "NewSessionView.vue"
Cohesion: 0.05
Nodes (33): ACCEPT, ALLOWED_EXT, Attached, canSubmit, criteria, CRITERIA_PRESET, criteriaError, criteriaMode (+25 more)

### Community 20 - "loadUserModelSettings.ts"
Cohesion: 0.48
Nodes (5): decryptSecret(), deriveKey(), encryptSecret(), loadUserModelSettings(), ref_node_crypto

### Community 21 - "uploadOne"
Cohesion: 0.50
Nodes (4): appendText(), handleFiles(), switchCriteriaMode(), uploadOne()

### Community 22 - "lengthState"
Cohesion: 0.67
Nodes (3): anyOverLimit, lengthMessage(), lengthState()

### Community 23 - "clearDraftStorage"
Cohesion: 0.67
Nodes (3): clearDraftStorage(), discardDraft(), submit()

### Community 24 - "isDirty"
Cohesion: 0.67
Nodes (3): isDirty(), loadDraft(), saveDraft()

### Community 26 - "GraphCanvas.vue"
Cohesion: 0.08
Nodes (22): clearSelection(), COLORS, emit, isReviewLink(), links, linkWidth(), neighbours, nodes (+14 more)

### Community 27 - "graph.ts"
Cohesion: 0.18
Nodes (13): buildSessionGraph(), domainOf(), EdgeKind, excerpt(), Graph, GraphEdge, GraphNode, NodeKind (+5 more)

### Community 28 - "FileDropZone.vue"
Cohesion: 0.27
Nodes (8): dragging, emit, hasFiles(), input, onDrop(), onEnter(), onPick(), props

### Community 29 - "auth.ts"
Cohesion: 0.31
Nodes (5): auth, router, supabase, useAuthStore, @supabase/supabase-js

### Community 30 - "stores/sessions.ts"
Cohesion: 0.22
Nodes (8): api, ChairmanVerdict, EvidenceDocument, EvidenceRequest, PeerReview, PersonaVerdict, RoleStatus, SessionSummary

### Community 31 - "run"
Cohesion: 0.25
Nodes (8): retryEvidence(), retryPersona(), retryReview(), run(), runChairman(), startGathering(), startReview(), startVerdicts()

### Community 32 - "AuthView.vue"
Cohesion: 0.29
Nodes (5): auth, email, error, loading, sent

### Community 33 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, d3-force, pinia, @supabase/supabase-js, vue, vue-router

### Community 34 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, @types/d3-force, typescript, vite, @vitejs/plugin-vue, vue-tsc

### Community 35 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, typecheck

## Knowledge Gaps
- **297 isolated node(s):** `ProviderDefault`, `CHAIRMAN_DEFAULTS`, `CHAIRMAN_FALLBACK_MODELS`, `CLERK_DEFAULT_MODELS`, `CLERK_FALLBACK_MODELS` (+292 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 338 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `auth.ts` to `council.ts`, `frontend/package.json`, `settings.ts`, `loadUserModelSettings.ts`?**
  _High betweenness centrality (0.283) - this node is a cross-community bridge._
- **Why does `vue` connect `router/index.ts` to `AuthView.vue`, `SessionResultsView.vue`, `SettingsView.vue`, `frontend/package.json`, `NewSessionView.vue`, `GraphCanvas.vue`, `FileDropZone.vue`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `vue-router` connect `router/index.ts` to `frontend/package.json`, `NewSessionView.vue`, `auth.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `ProviderDefault`, `CHAIRMAN_DEFAULTS`, `CHAIRMAN_FALLBACK_MODELS` to the rest of the system?**
  _297 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `council.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0656010656010656 - nodes in this community are weakly interconnected._
- **Should `modelRouter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08395989974937343 - nodes in this community are weakly interconnected._
- **Should `settings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0696969696969697 - nodes in this community are weakly interconnected._