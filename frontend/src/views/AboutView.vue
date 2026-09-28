<script setup lang="ts">
import { RouterLink } from "vue-router";
import AppIcon, { type IconName } from "../components/AppIcon.vue";
import HeroGraph from "../components/HeroGraph.vue";
import PersonaAvatar from "../components/PersonaAvatar.vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();

const steps: { title: string; icon: IconName; body: string }[] = [
  { title: "Gather evidence", icon: "evidence", body: "Each member says what real-world facts it needs (a market report, a competitor's numbers, a regulation). A clerk searches the web, downloads the best source and pulls out only the facts that matter." },
  { title: "Initial verdicts", icon: "users", body: "Every member reads your pitch and the evidence it asked for, then writes a verdict and a score out of 10, working independently." },
  { title: "Anonymous peer review", icon: "scale", body: "Each member reads the other verdicts with names hidden, critiques them and ranks them best to worst, so no opinion wins because of who said it." },
  { title: "Chairman’s decision", icon: "gavel", body: "The Chairman reads everything and makes the final call: Fund, Iterate or Pass, with an overall score and a short explanation." },
];

const roles = [
  { key: "judge", name: "Judge", job: "The rubric scorer", body: "Scores your idea against the judging criteria you entered, one criterion at a time. Neutral and fair. Its score carries the most weight with the Chairman.", asks: "Did the idea meet what the competition asked for?" },
  { key: "skeptic", name: "Skeptic", job: "The critic", body: "Hunts for reasons the idea could fail: weak assumptions, market and execution risk, and competitors.", asks: "What is most likely to go wrong?" },
  { key: "optimist", name: "Optimist", job: "The advocate", body: "Makes the strongest honest case for success: the upside, what it unlocks, and why momentum could build.", asks: "What if this works really well?" },
  { key: "market_analyst", name: "Market Analyst", job: "The outside view", body: "Looks at market size, competitors, how you are different and whether your go-to-market plan is believable.", asks: "Is there a real market, and can you reach it?" },
  { key: "tech_lead", name: "Technical Feasibility Lead", job: "The builder", body: "Checks that it can actually be built: complexity, dependencies, scaling and whether the scope fits your team and time.", asks: "Can this be built with what you have?" },
  { key: "vc_investor", name: "Reality Checker", job: "The blind-spot finder", body: "Catches the obvious problems teams miss because they are too close to their idea. It pictures the real user in their real day. A tool that needs a farmer to photograph every plant one by one will not be used.", asks: "Would real people really behave this way?" },
];
</script>

<template>
  <div class="about">
    <header v-if="!auth.isSignedIn" class="public-bar">
      <RouterLink to="/about" class="brand">
        <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="5" r="1.8" /><circle cx="16.5" cy="5" r="1.8" /><circle cx="10" cy="17" r="1.8" />
          <path d="M5 6l3 2.5M15 6l-3 2.5M10 12.6v2.6" />
        </svg>
        <span translate="no">Startup Council</span>
      </RouterLink>
      <RouterLink to="/auth" class="btn btn-secondary btn-sm">Sign In</RouterLink>
    </header>

    <div class="page wide">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><AppIcon name="sparkle" :size="13" /> How it works</p>
          <h1 class="hero-title">A council of AI reviewers for your startup idea</h1>
          <p class="lede">
            Six reviewers, each with a different job, judge your idea against your criteria. They look up evidence, review each other
            anonymously, and a Chairman makes the final call. You see every step, not only a score.
          </p>
          <div class="hero-cta">
            <RouterLink v-if="auth.isSignedIn" class="btn btn-lg" to="/sessions/new"><AppIcon name="plus" :size="16" /> Start a Judging</RouterLink>
            <RouterLink v-else class="btn btn-lg" to="/auth">Sign In to Start</RouterLink>
            <a href="#council" class="btn btn-ghost btn-lg">Meet the Council</a>
          </div>
        </div>
        <div class="hero-art">
          <HeroGraph />
        </div>
      </section>

      <!-- Steps -->
      <section class="block" aria-labelledby="steps-h">
        <h2 id="steps-h" class="section-title">Four steps, each one checkable</h2>
        <ol class="steps">
          <li v-for="(s, i) in steps" :key="s.title" class="step">
            <span class="step-icon"><AppIcon :name="s.icon" :size="18" /></span>
            <span class="step-n num">Step {{ i + 1 }}</span>
            <h3>{{ s.title }}</h3>
            <p>{{ s.body }}</p>
          </li>
        </ol>
      </section>

      <!-- What you do -->
      <section class="block you" aria-labelledby="you-h">
        <h2 id="you-h" class="section-title">What you do</h2>
        <ol class="you-list">
          <li><span class="num">1</span> Sign in with your email. It’s a magic link, no password.</li>
          <li><span class="num">2</span> Press <strong>New Judging</strong> and add your pitch, the judging criteria and, optionally, the problem statement. Paste text or upload PDF, DOCX, MD or TXT.</li>
          <li><span class="num">3</span> Run each of the four steps. You can check and retry each one before moving on.</li>
        </ol>
      </section>

      <!-- Council -->
      <section id="council" class="block" aria-labelledby="council-h">
        <h2 id="council-h" class="section-title">The council: who does what</h2>
        <p class="muted intro">Each role is deliberately different, so together they cover what a single reviewer would miss.</p>
        <ul class="roles">
          <li v-for="r in roles" :key="r.key" class="role">
            <header class="role-head">
              <PersonaAvatar :persona-key="r.key" :size="38" />
              <div>
                <h3>{{ r.name }}</h3>
                <span class="role-job">{{ r.job }}</span>
              </div>
            </header>
            <p>{{ r.body }}</p>
            <blockquote>“{{ r.asks }}”</blockquote>
          </li>
        </ul>

        <div class="extras">
          <div class="role wide-role chairman">
            <header class="role-head">
              <PersonaAvatar persona-key="chairman" :size="38" />
              <div>
                <h3>Chairman</h3>
                <span class="role-job">The final decision</span>
              </div>
            </header>
            <p>
              Doesn’t review the idea itself. It reads all the verdicts, the evidence and the peer rankings, then gives the overall score and a
              recommendation:
            </p>
            <ul class="recs">
              <li><span class="tag success">Fund</span> Strong, back it.</li>
              <li><span class="tag warn">Iterate</span> Promising, fix the issues first.</li>
              <li><span class="tag danger">Pass</span> Not ready.</li>
            </ul>
          </div>
          <div class="role wide-role">
            <header class="role-head">
              <span class="clerk-icon"><AppIcon name="evidence" :size="18" /></span>
              <div>
                <h3>Evidence clerk</h3>
                <span class="role-job">The researcher</span>
              </div>
            </header>
            <p>Not a voting member. It searches the web for what the council asked for and extracts the relevant facts, always citing real pages it retrieved.</p>
          </div>
        </div>
      </section>

      <!-- Good to know -->
      <section class="block" aria-labelledby="know-h">
        <h2 id="know-h" class="section-title">Good to know</h2>
        <ul class="know">
          <li><AppIcon name="cpu" :size="16" /><span>Every role can use a different AI model and provider. Choose them, and add your own API keys, in <strong>Settings</strong>. Keys are stored encrypted.</span></li>
          <li><AppIcon name="retry" :size="16" /><span>Free models can be slow or hit rate limits. If a step fails, retry just that part. More than one key per provider helps.</span></li>
          <li><AppIcon name="alert" :size="16" /><span>The council gives an informed second opinion. It can be wrong, so treat it as input, not a verdict on your idea.</span></li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.public-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem clamp(1rem, 4vw, 2rem);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fg);
  font-weight: 700;
}
.brand:hover {
  color: var(--fg);
  text-decoration: none;
}
.brand svg {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: center;
  padding: 1.5rem 0 3rem;
}
.hero-title {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.9rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.025em;
}
.hero .lede {
  font-size: 1.05rem;
  margin-top: 1rem;
}
.hero-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.75rem;
}
.hero-art {
  padding: 1.5rem;
  border-radius: 20px;
  background: radial-gradient(circle at 50% 50%, var(--accent-soft), transparent 70%);
}

.block {
  margin-bottom: 3rem;
}
.intro {
  margin: -0.4rem 0 1.25rem;
}

.steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: none;
}
.step {
  position: relative;
  padding: 1.1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.step-icon {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
}
.step-n {
  display: block;
  margin-top: 0.9rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.step h3 {
  margin: 0.2rem 0 0.4rem;
  font-size: 1rem;
}
.step p {
  margin: 0;
  font-size: 0.86rem;
  color: var(--fg-soft);
}

.you-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.you-list li {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  color: var(--fg-soft);
}
.you-list .num {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fg);
  transform: translateY(-1px);
}

.roles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.role {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.role-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.role-head h3 {
  margin: 0;
  font-size: 1rem;
}
.role-job {
  font-size: 0.8rem;
  color: var(--accent);
  font-weight: 600;
}
.role p {
  margin: 0;
  font-size: 0.88rem;
  color: var(--fg-soft);
}
.role blockquote {
  margin: auto 0 0;
  padding: 0.5rem 0 0 0.75rem;
  border-left: 2px solid var(--border-strong);
  font-size: 0.86rem;
  font-style: italic;
  color: var(--fg);
}
.extras {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.chairman {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: linear-gradient(135deg, var(--accent-soft), transparent 70%), var(--surface);
}
.recs {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.86rem;
  color: var(--fg-soft);
}
.recs .tag {
  width: 4.5rem;
  justify-content: center;
  margin-right: 0.5rem;
}
.clerk-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--hover);
  color: var(--fg-soft);
}

.know {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.know li {
  display: flex;
  gap: 0.75rem;
  color: var(--fg-soft);
  font-size: 0.92rem;
}
.know .app-icon {
  margin-top: 0.2rem;
  color: var(--accent);
}

@media (max-width: 960px) {
  .steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .hero {
    grid-template-columns: minmax(0, 1fr);
  }
  .hero-art {
    max-width: 320px;
    margin: 0 auto;
    order: -1;
  }
  .extras {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 520px) {
  .steps {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
