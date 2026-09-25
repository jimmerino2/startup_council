# Graph Report - startup_council  (2026-09-25)

## Corpus Check
- 62 files · ~27,234 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: (none) 13, .tsbuildinfo 2, .lock 1)

## Summary
- 539 nodes · 881 edges · 26 communities (22 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6eec3902`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- council.ts
- types.ts
- stores/sessions.ts
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

## God Nodes (most connected - your core abstractions)
1. `ModelCallError` - 14 edges
2. `Provider` - 14 edges
3. `compilerOptions` - 14 edges
4. `compilerOptions` - 13 edges
5. `callModel()` - 11 edges
6. `callGemini()` - 11 edges
7. `callOpenRouter()` - 11 edges
8. `runChairmanSynthesis()` - 10 edges
9. `judgePersona()` - 9 edges
10. `reviewPersona()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `judgePersona()` --calls--> `callModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `requestEvidence()` --calls--> `callModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `findEvidence()` --calls--> `callModelWithSearch()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `extractEvidence()` --calls--> `callModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `reviewPersona()` --calls--> `callModel()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four-step council judging flow** — readme_step1_gather_evidence, readme_step2_initial_verdicts, readme_step3_peer_review, readme_step4_chairman [EXTRACTED 0.95]

## Communities (26 total, 4 thin omitted)

### Community 0 - "council.ts"
Cohesion: 0.07
Nodes (60): CHAIRMAN_DEFAULTS, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_SYSTEM_PROMPT, CLERK_DEFAULT_MODELS, CLERK_SYSTEM_PROMPT, defaultModelFor(), EVIDENCE_EXTRACT_SYSTEM_PROMPT, EVIDENCE_REQUEST_SYSTEM_PROMPT() (+52 more)

### Community 1 - "types.ts"
Cohesion: 0.09
Nodes (48): callGemini(), GeminiResponse, RETRY_DELAYS_MS, sleep(), cursor, describeKey(), isUsable(), KeyedTarget (+40 more)

### Community 2 - "stores/sessions.ts"
Cohesion: 0.06
Nodes (33): auth, router, dragging, emit, hasFiles(), input, onDrop(), onEnter() (+25 more)

### Community 3 - "settings.ts"
Cohesion: 0.08
Nodes (29): CLERK_PROVIDERS, DEFAULT_MAX_EVIDENCE, MAX_EVIDENCE_LIMIT, app, missing, requiredEnvVars, AuthedRequest, requireAuth() (+21 more)

### Community 4 - "backend/package.json"
Cohesion: 0.05
Nodes (42): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+34 more)

### Community 5 - "SessionResultsView.vue"
Cohesion: 0.06
Nodes (38): actionError, allPersonasComplete, allReviewsComplete, anyReviewFailed, anyReviewRunning, averageRanking, busy, chairmanError (+30 more)

### Community 6 - "SettingsView.vue"
Cohesion: 0.07
Nodes (28): addKey(), ALL_ROLES, CLERK, CLERK_PROVIDERS, error, extractEvidence, keyAction(), keyBusy (+20 more)

### Community 7 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+18 more)

### Community 8 - "frontend/package.json"
Cohesion: 0.08
Nodes (24): dependencies, pinia, @supabase/supabase-js, vue, vue-router, devDependencies, typescript, vite (+16 more)

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
Nodes (33): ACCEPT, ALLOWED_EXT, Attached, canSubmit, composedProblem, criteria, CRITERIA_PRESET, criteriaError (+25 more)

### Community 20 - "loadUserModelSettings.ts"
Cohesion: 0.39
Nodes (6): decryptSecret(), deriveKey(), encryptSecret(), loadUserModelSettings(), UserModelSettings, ref_node_crypto

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

## Knowledge Gaps
- **268 isolated node(s):** `SessionRow`, `RESET_REVIEW`, `RawPersonaJson`, `RawReviewJson`, `RawChairmanJson` (+263 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 300 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vue` connect `stores/sessions.ts` to `frontend/package.json`, `NewSessionView.vue`, `SessionResultsView.vue`, `SettingsView.vue`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `pinia` connect `stores/sessions.ts` to `frontend/package.json`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Provider` connect `types.ts` to `council.ts`, `settings.ts`, `loadUserModelSettings.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `SessionRow`, `RESET_REVIEW`, `RawPersonaJson` to the rest of the system?**
  _268 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `council.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07319347319347319 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08644067796610169 - nodes in this community are weakly interconnected._
- **Should `stores/sessions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06028368794326241 - nodes in this community are weakly interconnected._