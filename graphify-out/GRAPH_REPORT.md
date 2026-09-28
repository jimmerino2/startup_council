# Graph Report - startup_council  (2026-09-28)

## Corpus Check
- 74 files · ~46,837 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: (none) 13, .tsbuildinfo 2, .lock 1)

## Summary
- 747 nodes · 1191 edges · 44 communities (38 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e72a9044`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- council.ts
- modelRouter.ts
- vue
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
- Startup Council: design
- uploadOne
- lengthState
- clearDraftStorage
- isDirty
- addCriterion
- GraphCanvas.vue
- graph.ts
- FileDropZone.vue
- App.vue
- stores/sessions.ts
- run
- AuthView.vue
- onMove
- PersonaAvatar.vue
- AppIcon.vue
- api.ts
- SessionsListView.vue
- select
- rebuild
- avgRankOf
- radiusOf
- auth.ts
- onTabKey

## God Nodes (most connected - your core abstractions)
1. `Startup Council: design` - 16 edges
2. `ModelCallError` - 14 edges
3. `Provider` - 14 edges
4. `compilerOptions` - 14 edges
5. `compilerOptions` - 13 edges
6. `vue` - 12 edges
7. `runChairmanSynthesis()` - 11 edges
8. `callModel()` - 11 edges
9. `callGemini()` - 11 edges
10. `callOpenRouter()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `PersonaConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/config/personas.ts → backend/src/types.ts
- `SessionRow` --references--> `PersonaKey`  [EXTRACTED]
  backend/src/routes/judge.ts → backend/src/types.ts
- `ProviderConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/services/openaiCompatible.ts → backend/src/types.ts
- `findEvidence()` --calls--> `callModelWithSearch()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `processRequest()` --calls--> `fetchDocument()`  [EXTRACTED]
  backend/src/services/evidencePipeline.ts → backend/src/services/fetchDocument.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four-step council judging flow** — readme_step1_gather_evidence, readme_step2_initial_verdicts, readme_step3_peer_review, readme_step4_chairman [EXTRACTED 0.95]

## Communities (44 total, 6 thin omitted)

### Community 0 - "council.ts"
Cohesion: 0.06
Nodes (73): CHAIRMAN_DEFAULTS, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_SYSTEM_PROMPT, CLERK_DEFAULT_MODELS, CLERK_FALLBACK_MODELS, CLERK_SYSTEM_PROMPT, defaultModelFor(), EVIDENCE_EXTRACT_SYSTEM_PROMPT (+65 more)

### Community 1 - "modelRouter.ts"
Cohesion: 0.08
Nodes (48): callGemini(), GeminiResponse, RETRY_DELAYS_MS, sleep(), cursor, describeKey(), isUsable(), KeyedTarget (+40 more)

### Community 2 - "vue"
Cohesion: 0.20
Nodes (8): dash, props, text, app, router, frontend_src_style, pinia, vue

### Community 3 - "settings.ts"
Cohesion: 0.07
Nodes (35): CLERK_PROVIDERS, DEFAULT_MAX_EVIDENCE, MAX_EVIDENCE_LIMIT, PERSONAS, app, missing, requiredEnvVars, AuthedRequest (+27 more)

### Community 4 - "backend/package.json"
Cohesion: 0.05
Nodes (42): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+34 more)

### Community 5 - "SessionResultsView.vue"
Cohesion: 0.03
Nodes (56): actionError, activeTab, allPersonasComplete, allReviewsComplete, anyReviewFailed, anyReviewRunning, anyVerdictFailed, anyVerdictRunning (+48 more)

### Community 6 - "SettingsView.vue"
Cohesion: 0.06
Nodes (34): addKey(), ALL_ROLES, CLERK, CLERK_PROVIDERS, error, extractEvidence, KEY_TONE, keyAction() (+26 more)

### Community 7 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+18 more)

### Community 8 - "frontend/package.json"
Cohesion: 0.07
Nodes (27): dependencies, d3-force, pinia, @supabase/supabase-js, vue, vue-router, devDependencies, @types/d3-force (+19 more)

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
Nodes (32): ACCEPT, ALLOWED_EXT, Attached, canSubmit, criteria, CRITERIA_PRESET, criteriaError, criteriaMode (+24 more)

### Community 20 - "Startup Council: design"
Cohesion: 0.12
Nodes (16): Accessibility, App structure, Build order, Data contract, Detail panel, Empty and partial states, Graph visual language (Obsidian graph view), Guidelines and tooling (+8 more)

### Community 21 - "uploadOne"
Cohesion: 0.50
Nodes (4): appendText(), handleFiles(), switchCriteriaMode(), uploadOne()

### Community 22 - "lengthState"
Cohesion: 0.50
Nodes (4): anyOverLimit, checklist, lengthMessage(), lengthState()

### Community 23 - "clearDraftStorage"
Cohesion: 0.67
Nodes (3): clearDraftStorage(), discardDraft(), submit()

### Community 24 - "isDirty"
Cohesion: 0.67
Nodes (3): isDirty(), loadDraft(), saveDraft()

### Community 26 - "GraphCanvas.vue"
Cohesion: 0.06
Nodes (27): focusId, hoverId, isFocusLink(), KIND_COLOR, LEGEND, linkOpacity(), links, matches (+19 more)

### Community 27 - "graph.ts"
Cohesion: 0.18
Nodes (13): buildSessionGraph(), domainOf(), EdgeKind, excerpt(), Graph, GraphEdge, GraphNode, NodeKind (+5 more)

### Community 28 - "FileDropZone.vue"
Cohesion: 0.27
Nodes (8): dragging, emit, hasFiles(), input, onDrop(), onEnter(), onPick(), props

### Community 29 - "App.vue"
Cohesion: 0.12
Nodes (15): activeId, auth, chrome, dateFormat, filter, filtered, narrow(), readSidebarPref() (+7 more)

### Community 30 - "stores/sessions.ts"
Cohesion: 0.22
Nodes (8): ChairmanVerdict, EvidenceDocument, EvidenceRequest, PeerReview, PersonaVerdict, RoleStatus, SessionSummary, useSessionsStore

### Community 31 - "run"
Cohesion: 0.25
Nodes (8): retryEvidence(), retryPersona(), retryReview(), run(), runChairman(), startGathering(), startReview(), startVerdicts()

### Community 32 - "AuthView.vue"
Cohesion: 0.24
Nodes (7): useAuthStore, auth, email, error, loading, sent, vue-router

### Community 33 - "onMove"
Cohesion: 0.24
Nodes (11): clampK(), fitView(), local(), onBackgroundDown(), onCanvasKey(), onMove(), onTick(), onWheel() (+3 more)

### Community 34 - "PersonaAvatar.vue"
Cohesion: 0.22
Nodes (9): hue, initials, meta, props, BY_KEY, personaMeta, PERSONAS, RECOMMENDATION_COLOR (+1 more)

### Community 35 - "AppIcon.vue"
Cohesion: 0.22
Nodes (7): IconName, PATHS, members, reviews, auth, roles, steps

### Community 36 - "api.ts"
Cohesion: 0.29
Nodes (4): api, GraphData, GraphEdge, GraphNode

### Community 37 - "SessionsListView.vue"
Cohesion: 0.29
Nodes (5): dateFormat, PIPELINE, stats, STATUS, store

### Community 38 - "select"
Cohesion: 0.33
Nodes (6): centerOn(), emit, onNodeKey(), onUp(), select(), selectFirstMatch()

### Community 39 - "rebuild"
Cohesion: 0.33
Nodes (6): initialPosition(), isReviewLink(), linkWidth(), rebuild(), resetLayout(), seeded()

### Community 40 - "avgRankOf"
Cohesion: 0.33
Nodes (6): personaLabel(), avgRankOf(), listRows, requesters(), selectedAvgRank, standings

### Community 41 - "radiusOf"
Cohesion: 0.40
Nodes (5): directed(), linkGeometry(), preview, radiusOf(), truncate()

## Knowledge Gaps
- **380 isolated node(s):** `Guidelines and tooling`, `Visual system`, `App structure`, `Scale`, `What it answers` (+375 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 431 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `auth.ts` to `council.ts`, `frontend/package.json`, `settings.ts`?**
  _High betweenness centrality (0.281) - this node is a cross-community bridge._
- **Why does `vue` connect `vue` to `AuthView.vue`, `PersonaAvatar.vue`, `SessionResultsView.vue`, `SessionsListView.vue`, `SettingsView.vue`, `frontend/package.json`, `NewSessionView.vue`, `GraphCanvas.vue`, `FileDropZone.vue`, `App.vue`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Why does `vue-router` connect `AuthView.vue` to `AppIcon.vue`, `SessionResultsView.vue`, `SessionsListView.vue`, `SettingsView.vue`, `frontend/package.json`, `NewSessionView.vue`, `App.vue`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `Guidelines and tooling`, `Visual system`, `App structure` to the rest of the system?**
  _380 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `council.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06142728093947606 - nodes in this community are weakly interconnected._
- **Should `modelRouter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08123904149620105 - nodes in this community are weakly interconnected._
- **Should `settings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06859903381642513 - nodes in this community are weakly interconnected._