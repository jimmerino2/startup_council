<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();

const steps = [
  { title: "Gather evidence", body: "Each council member says what real-world facts they need (a market report, a competitor's numbers, a regulation). A clerk searches the web, downloads the best source and pulls out only the facts that matter." },
  { title: "Initial verdicts", body: "All six members read your pitch and the evidence they asked for, then each gives a written verdict and a score out of 10, working independently." },
  { title: "Anonymous peer review", body: "Each member reads the other verdicts with names hidden, critiques them and ranks them best to worst. This stops any one opinion winning just because of who said it." },
  { title: "Chairman's decision", body: "The Chairman reads everything and makes the final call: Fund, Iterate or Pass, with an overall score and a short explanation." },
];

const roles = [
  { name: "Judge", job: "The rubric scorer.", body: "Scores your idea against the judging criteria you entered, one criterion at a time. Neutral and fair. Its score carries the most weight with the Chairman.", asks: "Did the idea meet what the competition asked for?" },
  { name: "Skeptic", job: "The critic.", body: "Hunts for reasons the idea could fail: weak assumptions, market and execution risk, and competitors.", asks: "What is most likely to go wrong?" },
  { name: "Optimist", job: "The advocate.", body: "Makes the strongest honest case for success: the upside, what it unlocks, and why momentum could build.", asks: "What if this works really well?" },
  { name: "Market Analyst", job: "The outside view.", body: "Looks at market size, competitors, how you are different and whether your go-to-market plan is believable.", asks: "Is there a real market, and can you reach it?" },
  { name: "Technical Feasibility Lead", job: "The builder.", body: "Checks that it can actually be built: complexity, dependencies, scaling and whether the scope fits your team and time.", asks: "Can this be built with what you have?" },
  { name: "Reality Checker", job: "The blind-spot finder.", body: "Catches the obvious problems that teams miss because they are too close to their idea. It imagines the real user in their real day and asks whether they would actually do this. For example, a tool that needs a farmer to photograph every plant one by one will not be used.", asks: "Would real people really behave this way?" },
];
</script>

<template>
  <div class="about">
    <h2>How Startup Council works</h2>
    <p class="lead">
      Submit your startup or hackathon idea and a panel of six AI reviewers, each with a different job, judges it against your
      criteria. They can look up evidence, review each other anonymously, and a Chairman gives the final decision. You see
      every step, so you can understand the result and not only get a score.
    </p>

    <h3>What you do</h3>
    <ol class="plain">
      <li>Sign in with your email (a magic link, no password).</li>
      <li>Click <strong>New Judging</strong> and enter the problem statement, the judging criteria and your pitch (paste it or upload a PDF, DOCX, MD or TXT).</li>
      <li>Press the button for each of the four steps below. You can check and retry each step before moving on.</li>
    </ol>

    <h3>The four steps</h3>
    <div v-for="(s, i) in steps" :key="s.title" class="card">
      <strong>{{ i + 1 }}. {{ s.title }}</strong>
      <p>{{ s.body }}</p>
    </div>

    <h3>The council: who does what</h3>
    <p class="muted">Each role is deliberately different, so together they cover what a single reviewer would miss.</p>
    <div v-for="r in roles" :key="r.name" class="card role-card">
      <div class="role-head">
        <strong>{{ r.name }}</strong>
        <span class="role-job">{{ r.job }}</span>
      </div>
      <p>{{ r.body }}</p>
      <p class="muted">Asks: <em>{{ r.asks }}</em></p>
    </div>

    <div class="card role-card chairman">
      <div class="role-head">
        <strong>Chairman</strong>
        <span class="role-job">The final decision</span>
      </div>
      <p>
        Does not review the idea itself. It reads all six verdicts, the evidence and the peer rankings, then gives the overall
        score and a recommendation: <strong>Fund</strong> (strong, back it), <strong>Iterate</strong> (promising, fix the
        issues first) or <strong>Pass</strong> (not ready).
      </p>
    </div>

    <div class="card role-card">
      <div class="role-head">
        <strong>Evidence clerk</strong>
        <span class="role-job">The researcher</span>
      </div>
      <p>Not a voting member. It searches the web for what the council asked for and extracts the relevant facts, always citing real pages it retrieved.</p>
    </div>

    <h3>Good to know</h3>
    <ul class="plain">
      <li>Every role can use a different AI model and provider. Choose them, and add your own API keys, in <strong>Settings</strong>. Keys are stored encrypted.</li>
      <li>Free models can be slow or hit rate limits. If a step fails, retry just that part. Adding more than one key per provider helps.</li>
      <li>The council gives an informed second opinion. It can be wrong, so treat it as input, not a verdict on your idea.</li>
    </ul>

    <p v-if="auth.isSignedIn"><RouterLink class="btn" to="/sessions/new">Start a judging</RouterLink></p>
    <p v-else><RouterLink class="btn" to="/auth">Sign in to start</RouterLink></p>
  </div>
</template>

<style scoped>
.about { max-width: 46rem; }
.lead { font-size: 1.05rem; line-height: 1.6; }
h3 { margin-top: 2rem; }
.plain { padding-left: 1.25rem; line-height: 1.7; }
.card p { margin: 0.4rem 0 0; line-height: 1.55; }
.role-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
.role-job { color: var(--accent); font-size: 0.9rem; font-weight: 600; }
.chairman { border-color: var(--accent); }
</style>
