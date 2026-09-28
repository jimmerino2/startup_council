# Graph Report - startup_council  (2026-09-28)

## Corpus Check
- Corpus is ~48,244 words - fits in a single context window. You may not need a graph.

## Summary
- 784 nodes · 1255 edges · 43 communities (36 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.84)
- Token cost: 59,406 input · 0 output

## Community Hubs (Navigation)
- Council Orchestration Pipeline
- Session Results Page State
- Model Providers & Key Rotation
- Backend API Routes & Auth
- Backend Dependencies
- Design System & UI Concepts
- Settings & API Key Management
- New Judging Form
- Graph Canvas Rendering
- Frontend Build Config
- Root Package Manifest
- Auth, Routing & Icons
- Workspace Shell (App.vue)
- Backend TS Config
- No-API-Key Gate & Home
- Product Overview (README)
- Frontend App TS Config
- Session Graph Builder
- Vercel Deployment Config
- Safe Document Fetching
- Graph Zoom & Pan
- Persona Metadata & Avatars
- File Drop Zone
- App Bootstrap & Score Ring
- API Client & Supabase
- Frontend Node TS Config
- Sessions Store & Types
- Stage Action Runners
- Graph Node Selection
- Graph Layout Seeding
- Peer Standing Calculations
- Graph Link Geometry
- Input Length Limits
- File Upload Extraction
- Draft Submit & Discard
- Draft Persistence
- Vite Env Types
- Frontend TS Project Refs
- Graph Link Highlighting
- Graph Node Types
- Rubric Row Editing
- Session Tab Navigation

## God Nodes (most connected - your core abstractions)
1. `ModelCallError` - 14 edges
2. `Provider` - 14 edges
3. `compilerOptions` - 14 edges
4. `compilerOptions` - 13 edges
5. `vue` - 12 edges
6. `Council Graph` - 12 edges
7. `runChairmanSynthesis()` - 11 edges
8. `callGemini()` - 11 edges
9. `callModel()` - 11 edges
10. `callOpenRouter()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `color-scheme / theme-color Meta Tags` --implements--> `Vercel Web Interface Guidelines`  [INFERRED]
  frontend/index.html → DESIGN.md
- `color-scheme / theme-color Meta Tags` --shares_data_with--> `CSS Design Tokens (:root)`  [INFERRED]
  frontend/index.html → DESIGN.md
- `#app Mount Point` --conceptually_related_to--> `Obsidian-Style Workspace Shell (App.vue)`  [INFERRED]
  frontend/index.html → DESIGN.md
- `PersonaConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/config/personas.ts → backend/src/types.ts
- `SessionRow` --references--> `PersonaKey`  [EXTRACTED]
  backend/src/routes/judge.ts → backend/src/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four-step council judging flow** — readme_step1_gather_evidence, readme_step2_initial_verdicts, readme_step3_peer_review, readme_step4_chairman [EXTRACTED 0.95]
- **No-API-Keys Gating Across Pages** — frontend_src_stores_keys, design_home_page, design_new_judging_page, design_settings_page, design_sidebar, design_post_api_sessions [EXTRACTED 1.00]
- **Session Stepper Tabs** — design_evidence_tab, design_verdicts_tab, design_peer_review_tab, design_decision_tab, design_council_graph [EXTRACTED 1.00]
- **Graph Backend-to-Frontend Pipeline** — design_get_session_graph_endpoint, backend_src_services_graph, design_graph_data_contract, design_council_graph, design_force_directed_layout [INFERRED 0.85]

## Communities (43 total, 7 thin omitted)

### Community 0 - "Council Orchestration Pipeline"
Cohesion: 0.07
Nodes (68): CHAIRMAN_DEFAULTS, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_SYSTEM_PROMPT, CLERK_DEFAULT_MODELS, CLERK_FALLBACK_MODELS, CLERK_SYSTEM_PROMPT, defaultModelFor(), EVIDENCE_EXTRACT_SYSTEM_PROMPT (+60 more)

### Community 1 - "Session Results Page State"
Cohesion: 0.03
Nodes (56): actionError, activeTab, allPersonasComplete, allReviewsComplete, anyReviewFailed, anyReviewRunning, anyVerdictFailed, anyVerdictRunning (+48 more)

### Community 2 - "Model Providers & Key Rotation"
Cohesion: 0.09
Nodes (47): callGemini(), GeminiResponse, RETRY_DELAYS_MS, sleep(), cursor, describeKey(), isUsable(), KeyedTarget (+39 more)

### Community 3 - "Backend API Routes & Auth"
Cohesion: 0.06
Nodes (41): CLERK_PROVIDERS, DEFAULT_MAX_EVIDENCE, MAX_EVIDENCE_LIMIT, PERSONAS, app, missing, requiredEnvVars, AuthedRequest (+33 more)

### Community 4 - "Backend Dependencies"
Cohesion: 0.05
Nodes (42): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+34 more)

### Community 5 - "Design System & UI Concepts"
Cohesion: 0.06
Nodes (42): About Page, AppIcon, Build Order / Roadmap, Council Graph, Cross-Session Graph (dropped), Decision Tab, CSS Design Tokens (:root), Graph Detail Panel (+34 more)

### Community 6 - "Settings & API Key Management"
Cohesion: 0.06
Nodes (36): addKey(), ALL_ROLES, CLERK, CLERK_PROVIDERS, error, extractEvidence, firstKeyAdded, KEY_TONE (+28 more)

### Community 7 - "New Judging Form"
Cohesion: 0.05
Nodes (33): ACCEPT, ALLOWED_EXT, Attached, canSubmit, criteria, CRITERIA_PRESET, criteriaError, criteriaMode (+25 more)

### Community 8 - "Graph Canvas Rendering"
Cohesion: 0.06
Nodes (24): focusId, hoverId, KIND_COLOR, LEGEND, links, matches, neighbours, nodes (+16 more)

### Community 9 - "Frontend Build Config"
Cohesion: 0.07
Nodes (28): dependencies, d3-force, pinia, @supabase/supabase-js, vue, vue-router, devDependencies, @types/d3-force (+20 more)

### Community 10 - "Root Package Manifest"
Cohesion: 0.07
Nodes (26): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+18 more)

### Community 11 - "Auth, Routing & Icons"
Cohesion: 0.14
Nodes (14): IconName, PATHS, members, reviews, useAuthStore, auth, roles, steps (+6 more)

### Community 12 - "Workspace Shell (App.vue)"
Cohesion: 0.12
Nodes (16): activeId, auth, chrome, dateFormat, filter, filtered, keys, narrow() (+8 more)

### Community 13 - "Backend TS Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir (+7 more)

### Community 14 - "No-API-Key Gate & Home"
Cohesion: 0.13
Nodes (13): Home Page (/sessions), New Judging Page, No API Keys Gate, OpenRouter, POST /api/sessions (403 no_api_keys), Settings Page, useKeysStore, dateFormat (+5 more)

### Community 15 - "Product Overview (README)"
Cohesion: 0.14
Nodes (16): Cost per judged idea, Six council personas, Evidence clerk model, Evidence request statuses, Document fetch with SSRF protection, Model providers, Multiple API keys and rotation, Project structure (+8 more)

### Community 16 - "Frontend App TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 17 - "Session Graph Builder"
Cohesion: 0.18
Nodes (13): buildSessionGraph(), domainOf(), EdgeKind, excerpt(), Graph, GraphEdge, GraphNode, NodeKind (+5 more)

### Community 18 - "Vercel Deployment Config"
Cohesion: 0.14
Nodes (13): includeFiles, maxDuration, entrypoint, functions, root, framework, rewrites, root (+5 more)

### Community 19 - "Safe Document Fetching"
Cohesion: 0.26
Nodes (12): assertPublicHost(), decodeEntities(), fetchDocument(), FetchedDocument, htmlToText(), isPrivateIPv4(), isPrivateIPv6(), MAX_RAW_CHARS (+4 more)

### Community 20 - "Graph Zoom & Pan"
Cohesion: 0.24
Nodes (11): clampK(), fitView(), local(), onBackgroundDown(), onCanvasKey(), onMove(), onTick(), onWheel() (+3 more)

### Community 21 - "Persona Metadata & Avatars"
Cohesion: 0.22
Nodes (9): hue, initials, meta, props, BY_KEY, personaMeta, PERSONAS, RECOMMENDATION_COLOR (+1 more)

### Community 22 - "File Drop Zone"
Cohesion: 0.27
Nodes (8): dragging, emit, hasFiles(), input, onDrop(), onEnter(), onPick(), props

### Community 23 - "App Bootstrap & Score Ring"
Cohesion: 0.20
Nodes (8): dash, props, text, app, router, frontend_src_style, pinia, vue

### Community 24 - "API Client & Supabase"
Cohesion: 0.27
Nodes (5): api, GraphData, GraphEdge, supabase, ref_supabase_supabase_js

### Community 25 - "Frontend Node TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 26 - "Sessions Store & Types"
Cohesion: 0.22
Nodes (8): ChairmanVerdict, EvidenceDocument, EvidenceRequest, PeerReview, PersonaVerdict, RoleStatus, SessionSummary, useSessionsStore

### Community 27 - "Stage Action Runners"
Cohesion: 0.25
Nodes (8): retryEvidence(), retryPersona(), retryReview(), run(), runChairman(), startGathering(), startReview(), startVerdicts()

### Community 28 - "Graph Node Selection"
Cohesion: 0.33
Nodes (6): centerOn(), emit, onNodeKey(), onUp(), select(), selectFirstMatch()

### Community 29 - "Graph Layout Seeding"
Cohesion: 0.33
Nodes (6): initialPosition(), isReviewLink(), linkWidth(), rebuild(), resetLayout(), seeded()

### Community 30 - "Peer Standing Calculations"
Cohesion: 0.33
Nodes (6): personaLabel(), avgRankOf(), listRows, requesters(), selectedAvgRank, standings

### Community 31 - "Graph Link Geometry"
Cohesion: 0.40
Nodes (5): directed(), linkGeometry(), preview, radiusOf(), truncate()

### Community 32 - "Input Length Limits"
Cohesion: 0.50
Nodes (4): anyOverLimit, checklist, lengthMessage(), lengthState()

### Community 33 - "File Upload Extraction"
Cohesion: 0.50
Nodes (4): appendText(), handleFiles(), switchCriteriaMode(), uploadOne()

### Community 34 - "Draft Submit & Discard"
Cohesion: 0.67
Nodes (3): clearDraftStorage(), discardDraft(), submit()

### Community 35 - "Draft Persistence"
Cohesion: 0.67
Nodes (3): isDirty(), loadDraft(), saveDraft()

## Knowledge Gaps
- **385 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+380 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 435 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vue` connect `App Bootstrap & Score Ring` to `Session Results Page State`, `Settings & API Key Management`, `New Judging Form`, `Graph Canvas Rendering`, `Frontend Build Config`, `Auth, Routing & Icons`, `Workspace Shell (App.vue)`, `No-API-Key Gate & Home`, `Persona Metadata & Avatars`, `File Drop Zone`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `Session Sidebar` connect `Design System & UI Concepts` to `No-API-Key Gate & Home`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _385 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Council Orchestration Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06553128470936691 - nodes in this community are weakly interconnected._
- **Should `Session Results Page State` be split into smaller, more focused modules?**
  _Cohesion score 0.029850746268656716 - nodes in this community are weakly interconnected._
- **Should `Model Providers & Key Rotation` be split into smaller, more focused modules?**
  _Cohesion score 0.08649912331969609 - nodes in this community are weakly interconnected._
- **Should `Backend API Routes & Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.05870020964360587 - nodes in this community are weakly interconnected._