// Creates the "Desk Caller" ElevenLabs agent and its four client tools, then reads the agent back to
// check every dynamic variable has a default (a missing one stops a call from starting).
// Usage: node --env-file=apps/api/.env.local scripts/voice/create-agent.mjs
//        node --env-file=apps/api/.env.local scripts/voice/create-agent.mjs --update <agent_id>   (new prompt, same tools,
//        typing sound on each tool, end_call switched on)
// Prints ELEVENLABS_AGENT_ID=<id> to put in apps/api/.env.local.

const API = "https://api.elevenlabs.io";
const KEY = process.env.ELEVENLABS_API_KEY;
const LLM = process.env.ELEVENLABS_AGENT_LLM || "claude-haiku-4-5";

const FIRST_MESSAGE = "Hi, this is the delivery desk assistant, an AI. This call is recorded for the case log. Are you safe to talk?";

// Defaults for every variable the prompt uses. Real values come from POST /api/voice/session.
const PLACEHOLDERS = {
  call_purpose: "call",
  case_id: "unknown",
  call_id: "unknown",
  callee_role: "contact",
  callee_name: "there",
  case_brief: "No case details were provided.",
  goal: "Find out how the desk can help.",
  questions: "none",
  options: "none",
  boundaries: "Never promise anything. Never ask for codes or personal details.",
};

const SYSTEM_PROMPT = `You are the voice of a delivery operations desk. You are an AI and never pretend otherwise.
You are calling {{callee_name}} ({{callee_role}}) about case {{case_id}}. Purpose of this call: {{call_purpose}}.
Goal: {{goal}}

What you may know and say about the case (nothing else):
{{case_brief}}

Questions you may ask, at most these:
{{questions}}

Rules you must always follow:
{{boundaries}}

How to behave:
- Before sharing anything about the case, confirm you are speaking to {{callee_name}}. If you reach voicemail or someone else, leave no case details: only ask them to contact the delivery desk.
- Keep sentences short and plain. One question at a time.
- Reference numbers, times, dates and addresses are easy to mishear. Read any that matter back to the person and wait for a clear yes before relying on them.
- Before saying anything that promises money, a refund, compensation, a time or an outcome, call propose_commitment with the exact sentence you want to say, then say only the wording it returns.
- When the person tells you a fact that matters to the case, call record_fact.
- If the person wants a human, asks for something outside these rules, or the call goes off track, call request_human and end the call politely.
- If this is an approval call (purpose "approval"), the options are: {{options}}. Explain the situation and each option in plain words, ask which option they choose, then read their choice back ("Confirming option-2: decline politely. Is that right?"). Only after a clear yes, call submit_decision with that option id and their own words. If they are unsure, do not choose for them.`;

const TOOLS = [
  {
    name: "submit_decision",
    description: "Submit the option the person chose on an approval call, only after reading it back and hearing a clear yes.",
    parameters: {
      type: "object",
      properties: {
        option_id: { type: "string", description: "The id of the chosen option, for example option-2." },
        spoken_confirmation: { type: "string", description: "The person's own words confirming the choice." },
      },
      required: ["option_id", "spoken_confirmation"],
    },
  },
  {
    name: "propose_commitment",
    description: "Check a sentence that promises money, a refund, compensation, a time or an outcome before saying it. Say only the wording returned.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "The exact sentence you want to say." },
        type: { type: "string", enum: ["time", "money", "redelivery", "other"], description: "What kind of promise it is." },
      },
      required: ["text", "type"],
    },
  },
  {
    name: "record_fact",
    description: "Record a fact the person stated that matters to the case.",
    parameters: {
      type: "object",
      properties: {
        field: { type: "string", description: "What the fact is about, for example access or availability." },
        value: { type: "string", description: "What the person said, in their words." },
        speaker_role: { type: "string", description: "Who said it, for example recipient or driver." },
      },
      required: ["field", "value", "speaker_role"],
    },
  },
  {
    name: "request_human",
    description: "Hand the call to a person at the desk when the request is outside your rules or the person asks for a human.",
    parameters: {
      type: "object",
      properties: { reason: { type: "string", description: "Why a person is needed." } },
      required: ["reason"],
    },
  },
];

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} answered ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// A typing sound while a tool runs (the gate check takes up to 2.5 s), and the agent may hang up itself
// once the call is done, which ends the session and hands the transcript to the console.
const TOOL_SOUND = { tool_call_sound: "typing", tool_call_sound_behavior: "auto" };
const END_CALL = { type: "system", name: "end_call", description: "", params: { system_tool_type: "end_call" } };

async function update(id) {
  const current = await call("GET", `/v1/convai/agents/${id}`);
  const prompt = current?.conversation_config?.agent?.prompt ?? {};
  for (const toolId of prompt.tool_ids ?? []) {
    const tool = await call("GET", `/v1/convai/tools/${toolId}`);
    await call("PATCH", `/v1/convai/tools/${toolId}`, { tool_config: { ...tool.tool_config, ...TOOL_SOUND } });
  }
  await call("PATCH", `/v1/convai/agents/${id}`, {
    conversation_config: {
      agent: {
        first_message: FIRST_MESSAGE,
        prompt: { prompt: SYSTEM_PROMPT, llm: prompt.llm ?? LLM, tool_ids: prompt.tool_ids ?? [], built_in_tools: { end_call: END_CALL } },
        dynamic_variables: { dynamic_variable_placeholders: PLACEHOLDERS },
      },
    },
  });
  return id;
}

async function verify(id) {
  const stored = await call("GET", `/v1/convai/agents/${id}`);
  const agentCfg = stored?.conversation_config?.agent ?? {};
  const kept = agentCfg.dynamic_variables?.dynamic_variable_placeholders ?? {};
  const missing = Object.keys(PLACEHOLDERS).filter((k) => !(k in kept));
  console.log(`agent model: ${agentCfg.prompt?.llm}, tools: ${(agentCfg.prompt?.tool_ids ?? []).length}, can hang up: ${Boolean(agentCfg.prompt?.built_in_tools?.end_call)}`);
  console.log(`prompt has read-back rule: ${String(agentCfg.prompt?.prompt ?? "").includes("Read any that matter back")}`);
  if (missing.length) console.log(`WARNING: placeholders not stored for: ${missing.join(", ")}`);
  else console.log("all 10 variable defaults stored");
}

async function main() {
  if (!KEY) throw new Error("ELEVENLABS_API_KEY is not set. Run with --env-file=apps/api/.env.local");
  const at = process.argv.indexOf("--update");
  if (at !== -1) {
    const id = process.argv[at + 1];
    if (!id) throw new Error("--update needs the agent id");
    await update(id);
    await verify(id);
    console.log(`updated ELEVENLABS_AGENT_ID=${id}`);
    return;
  }
  const toolIds = [];
  for (const tool of TOOLS) {
    const created = await call("POST", "/v1/convai/tools", {
      tool_config: { type: "client", ...tool, expects_response: true, response_timeout_secs: 10, ...TOOL_SOUND },
    });
    toolIds.push(created.id);
    console.log(`tool ${tool.name}: ${created.id}`);
  }
  const agent = await call("POST", "/v1/convai/agents/create", {
    name: "Desk Caller",
    conversation_config: {
      agent: {
        first_message: FIRST_MESSAGE,
        language: "en",
        prompt: { prompt: SYSTEM_PROMPT, llm: LLM, tool_ids: toolIds, built_in_tools: { end_call: END_CALL } },
        dynamic_variables: { dynamic_variable_placeholders: PLACEHOLDERS },
      },
    },
  });
  const id = agent.agent_id;
  await verify(id);
  console.log(`ELEVENLABS_AGENT_ID=${id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
