// Creates the "Desk Caller" ElevenLabs agent and its four client tools, then reads the agent back to
// check every dynamic variable has a default (a missing one stops a call from starting).
// Usage: node --env-file=apps/api/.env.local scripts/voice/create-agent.mjs
//        node --env-file=apps/api/.env.local scripts/voice/create-agent.mjs --update <agent_id>   (new prompt, same tools,
//        typing sound on each tool, end_call switched on)
// Prints ELEVENLABS_AGENT_ID=<id> to put in apps/api/.env.local.

const API = "https://api.elevenlabs.io";
const KEY = process.env.ELEVENLABS_API_KEY;
const LLM = process.env.ELEVENLABS_AGENT_LLM || "claude-haiku-4-5";

// The opener is the identity check, so the agent never asks it a second time.
const FIRST_MESSAGE = "Hi, is this {{callee_name}}? It's the AI assistant from the Rivet delivery desk, on a recorded line.";

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

// Written for a phone call: short turns, no filler, one question at a time, confirm once, hang up when
// done (ElevenLabs agent prompting guide; "This step is important" marks the critical steps).
const SYSTEM_PROMPT = `You are the voice of the Rivet delivery desk, phoning {{callee_name}} ({{callee_role}}) about case {{case_id}}. You are an AI and never pretend otherwise.
Purpose: {{call_purpose}}. Goal of this call: {{goal}}

What you may know and say about the case (nothing else):
{{case_brief}}

Questions you may ask, at most these:
{{questions}}

Rules you must always follow:
{{boundaries}}

# Style
- Sound like a busy, polite human dispatcher on the phone: plain, calm, direct.
- One or two short sentences per turn, under 25 words. No lists.
- Ask one question per turn, then stop and wait.
- No praise or filler: never say "wonderful", "perfect", "great", "amazing" or "absolutely". "Okay" or "Got it" is enough. Thank the person at most once.
- Never repeat or paraphrase what the person just said, and never say the same sentence twice.
- Say numbers like a person: "ten o'clock", not "10:00 UTC". Read reference codes letter by letter and digit by digit.
- Output only the words to speak. Never write anything in square brackets.

# The call
- Your first message already asked whether you are speaking to {{callee_name}}. Once they say yes, never ask about identity again. If it is someone else or voicemail, give no case details: ask them to contact the delivery desk, then end the call.
- Every turn moves toward the goal. No small talk.
- When the person states a fact that matters, call record_fact once. Do not announce it.
- Read back only the facts the outcome depends on (a time, a gate, a reference), once, in one sentence, and wait for a clear yes.
- If you did not catch something, say once: "Sorry, it's loud here, say that again?" If it fails again, call request_human.

# Guardrails
- Before saying anything that promises money, a refund, compensation, a time or an outcome, call propose_commitment with the exact sentence. Say only the wording it returns. If it refuses, say the refusal and nothing more. This step is important.
- Never ask for phone numbers, codes, passwords or other personal details, even to help.
- If the person wants a human, asks for something outside these rules, or the call goes off track, call request_human, then say in one sentence that a person at the desk will follow up, and end the call.
- Approval calls (purpose "approval"): the options are {{options}}. Say the situation and each option in one or two sentences, ask which they choose, read their choice back once ("Option two, decline politely. Correct?"), and only after a clear yes call submit_decision with that option id and their own words. If they are unsure, do not choose for them.
- As soon as the goal is met and recorded, or submit_decision has succeeded, say a short goodbye ("Thanks, bye.") and call end_call. Never ask "anything else?". This step is important.`;

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
const END_CALL = {
  type: "system", name: "end_call", params: { system_tool_type: "end_call" },
  description: "Call this as soon as the call goal is met and recorded, or submit_decision has succeeded, or the person wants to hang up. Say a short goodbye first. Never ask if they need anything else.",
};
// No expressive audio tags ("[happy]"), the opener cannot be cut off by room noise, a silent line hangs
// up after 25 s and no call runs past 4 minutes.
const TUNING = {
  tts: { expressive_mode: false, suggested_audio_tags: [] },
  turn: { silence_end_call_timeout: 25 },
  conversation: { max_duration_seconds: 240 },
};

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
        disable_first_message_interruptions: true,
      },
      ...TUNING,
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
  console.log(`prompt has read-back rule: ${String(agentCfg.prompt?.prompt ?? "").includes("Read back only the facts")}`);
  const c = stored?.conversation_config ?? {};
  console.log(`expressive tags off: ${c.tts?.expressive_mode === false}, max call: ${c.conversation?.max_duration_seconds} s, silent line hangs up after: ${c.turn?.silence_end_call_timeout} s, voice: ${c.tts?.voice_id}`);
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
        disable_first_message_interruptions: true,
      },
      ...TUNING,
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
