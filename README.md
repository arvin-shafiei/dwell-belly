# Delivery Ops Agent

An AI control room for delivery companies: it watches every order, fixes safe problems itself, sends risky ones to the right human with a one-tap decision card, and earns more trust over time.

- Idea in plain words: [`docs/IDEA.md`](docs/IDEA.md)
- Full spec: [`SPEC.md`](SPEC.md)

## Layout

```
apps/
  api/   Next.js backend (route handlers only), port 4000
         src/lib/flow.ts        flow + node types
         flows/*.json           flow definitions
         src/app/api/health     GET  health check
         src/app/api/flows      GET  list flows
         src/app/api/cases      GET/POST cases (stub)
         src/app/api/data/cases GET synthetic cases (list, one, ?view=escalation)
  web/   Next.js frontend (Tailwind), port 3000
data/             200 synthetic practice cases: raw + parsed JSON (see data/README.md)
scripts/          build-data.mjs parses data/raw -> data/cases + data/index.json
docs/             IDEA.md, hackathon guide + rules
.claude/skills/   superpowers + typesafe-ai skills for Claude Code
```

## Run it

```bash
npm install
cp apps/api/.env.example apps/api/.env.local   # add ANTHROPIC_API_KEY, TYPESAFE_API_KEY
cp apps/web/.env.example apps/web/.env.local
npm run dev        # api on :4000, web on :3000
```

Other scripts: `npm run build`, `npm run lint`, `npm run data` (rebuild parsed cases).

## Models / APIs

- **Jev** (TypeSafe AI): fast typed judgements (triage, clash score, risk score, verify)
- **Claude** (Anthropic): planning, decision cards, claim extraction, Architect
- **OR-Tools**: route replanning

## License

Apache 2.0. See [`LICENSE`](LICENSE).
