# Graph Report - startup_council  (2026-09-25)

## Corpus Check
- Corpus is ~23,520 words - fits in a single context window. You may not need a graph.

## Summary
- 487 nodes · 813 edges · 19 communities (16 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Personas & Prompts
- Gemini & Key Rotation
- Frontend App & API Client
- Backend Entry & Config
- Backend Dependencies
- Session Results View
- Settings View
- Root Dependencies
- Frontend Dependencies
- Backend TS Config
- README Concepts
- Frontend TS App Config
- Vercel Config
- Document Fetching
- Node TS Config
- HTML Entry Point
- Vite Env Types
- Frontend TS Config

## God Nodes (most connected - your core abstractions)
1. `ModelCallError` - 14 edges
2. `Provider` - 14 edges
3. `compilerOptions` - 14 edges
4. `compilerOptions` - 13 edges
5. `callGemini()` - 11 edges
6. `callModel()` - 11 edges
7. `callOpenRouter()` - 11 edges
8. `runChairmanSynthesis()` - 10 edges
9. `resolveModelTarget()` - 9 edges
10. `judgePersona()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `PersonaConfig` --references--> `Provider`  [EXTRACTED]
  backend/src/config/personas.ts → backend/src/types.ts
- `findEvidence()` --calls--> `callModelWithSearch()`  [EXTRACTED]
  backend/src/services/council.ts → backend/src/services/modelRouter.ts
- `EvidenceContext` --references--> `SessionInput`  [EXTRACTED]
  backend/src/services/evidencePipeline.ts → backend/src/types.ts
- `processRequest()` --calls--> `fetchDocument()`  [EXTRACTED]
  backend/src/services/evidencePipeline.ts → backend/src/services/fetchDocument.ts
- `callModel()` --calls--> `callGemini()`  [EXTRACTED]
  backend/src/services/modelRouter.ts → backend/src/services/gemini.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four-step council judging flow** — readme_step1_gather_evidence, readme_step2_initial_verdicts, readme_step3_peer_review, readme_step4_chairman [EXTRACTED 0.95]

## Communities (19 total, 3 thin omitted)

### Community 0 - "Personas & Prompts"
Cohesion: 0.08
Nodes (59): CHAIRMAN_DEFAULTS, CHAIRMAN_FALLBACK_MODELS, CHAIRMAN_SYSTEM_PROMPT, CLERK_DEFAULT_MODELS, CLERK_SYSTEM_PROMPT, defaultModelFor(), EVIDENCE_EXTRACT_SYSTEM_PROMPT, EVIDENCE_REQUEST_SYSTEM_PROMPT() (+51 more)

### Community 1 - "Gemini & Key Rotation"
Cohesion: 0.08
Nodes (48): callGemini(), GeminiResponse, RETRY_DELAYS_MS, sleep(), cursor, describeKey(), isUsable(), KeyedTarget (+40 more)

### Community 2 - "Frontend App & API Client"
Cohesion: 0.06
Nodes (34): auth, router, api, supabase, app, router, useAuthStore, ChairmanVerdict (+26 more)

### Community 3 - "Backend Entry & Config"
Cohesion: 0.07
Nodes (36): CLERK_PROVIDERS, DEFAULT_MAX_EVIDENCE, MAX_EVIDENCE_LIMIT, PERSONAS, app, missing, requiredEnvVars, AuthedRequest (+28 more)

### Community 4 - "Backend Dependencies"
Cohesion: 0.05
Nodes (42): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+34 more)

### Community 5 - "Session Results View"
Cohesion: 0.06
Nodes (37): actionError, allPersonasComplete, allReviewsComplete, anyReviewFailed, anyReviewRunning, averageRanking, busy, chairmanError (+29 more)

### Community 6 - "Settings View"
Cohesion: 0.07
Nodes (28): addKey(), ALL_ROLES, CLERK, CLERK_PROVIDERS, error, extractEvidence, keyAction(), keyBusy (+20 more)

### Community 7 - "Root Dependencies"
Cohesion: 0.07
Nodes (26): dependencies, cors, dotenv, express, mammoth, multer, pdf-parse, @supabase/supabase-js (+18 more)

### Community 8 - "Frontend Dependencies"
Cohesion: 0.08
Nodes (24): dependencies, pinia, @supabase/supabase-js, vue, vue-router, devDependencies, typescript, vite (+16 more)

### Community 9 - "Backend TS Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir (+7 more)

### Community 10 - "README Concepts"
Cohesion: 0.14
Nodes (16): Cost per judged idea, Six council personas, Evidence clerk model, Evidence request statuses, Document fetch with SSRF protection, Model providers, Multiple API keys and rotation, Project structure (+8 more)

### Community 11 - "Frontend TS App Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 12 - "Vercel Config"
Cohesion: 0.14
Nodes (13): includeFiles, maxDuration, entrypoint, functions, root, framework, rewrites, root (+5 more)

### Community 13 - "Document Fetching"
Cohesion: 0.26
Nodes (12): assertPublicHost(), decodeEntities(), fetchDocument(), FetchedDocument, htmlToText(), isPrivateIPv4(), isPrivateIPv6(), MAX_RAW_CHARS (+4 more)

### Community 14 - "Node TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 15 - "HTML Entry Point"
Cohesion: 1.00
Nodes (3): #app mount point, Startup Council index.html, src/main.ts entry module

## Knowledge Gaps
- **240 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+235 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 269 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pinia` connect `Frontend App & API Client` to `Frontend Dependencies`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `vue` connect `Frontend App & API Client` to `Frontend Dependencies`, `Session Results View`, `Settings View`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `Provider` connect `Gemini & Key Rotation` to `Personas & Prompts`, `Backend Entry & Config`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _240 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Personas & Prompts` be split into smaller, more focused modules?**
  _Cohesion score 0.07596153846153846 - nodes in this community are weakly interconnected._
- **Should `Gemini & Key Rotation` be split into smaller, more focused modules?**
  _Cohesion score 0.08415300546448087 - nodes in this community are weakly interconnected._
- **Should `Frontend App & API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.05877551020408163 - nodes in this community are weakly interconnected._