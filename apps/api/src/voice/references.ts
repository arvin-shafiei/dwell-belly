// Case-aware transcription. Speech-to-text gets reference codes wrong by a digit ("DL-6010" heard as
// "DL6210"), which would point at someone else's parcel. Two defences: tell the transcriber which
// references, times and people this case contains (keyterms), and flag any reference in a transcript
// that the case does not contain, so the agent treats it as a possible mis-hearing.

const REFERENCE = /\b[A-Z]{2,4}-?\d+\b/g;
const TIME = /\b\d{1,2}:\d{2}\b/g;
// "From: Name, role" and "- **From:** Name, role", as written in case files and parsed views.
const SENDER = /From:\**\s*([^,\n]+)/g;
const MAX_TERMS = 100;

const norm = (ref: string) => ref.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The terms the transcriber should expect, cleaned to the API's rules (under 50 characters, at most 5 words, no <>{}[]\). */
export function caseKeyterms(caseText: string): string[] {
  const found = [
    ...(caseText.match(REFERENCE) ?? []),
    ...(caseText.match(TIME) ?? []),
    ...[...caseText.matchAll(SENDER)].map((m) => m[1]),
  ];
  const terms: string[] = [];
  for (const raw of found) {
    const term = raw.replace(/[<>{}[\]\\*]/g, "").replace(/\s+/g, " ").trim();
    if (!term || term.length >= 50 || term.split(" ").length > 5 || terms.includes(term)) continue;
    terms.push(term);
    if (terms.length === MAX_TERMS) break;
  }
  return terms;
}

/** References in the transcript that do not appear anywhere in the case. */
export function unknownReferences(transcript: string, caseText: string): string[] {
  const known = new Set((caseText.match(REFERENCE) ?? []).map(norm));
  const heard = transcript.match(/\b[A-Za-z]{2,4}-?\d+\b/g) ?? [];
  return [...new Set(heard.filter((r) => /\d/.test(r) && !known.has(norm(r))))];
}

/** Appends a warning for each reference the case does not contain, so the agent asks rather than acts on a mis-hearing. */
export function withReferenceCheck(transcript: string, caseText: string): string {
  if (!caseText) return transcript;
  const unknown = unknownReferences(transcript, caseText);
  if (!unknown.length) return transcript;
  return `${transcript} [possible mis-hearing: ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not ${unknown.length === 1 ? "a reference" : "references"} in this case; confirm with the speaker]`;
}

/** Case events as plain text ("From: sender" then the message), the form caseKeyterms and the reference check read. */
export function caseTextOf(events: { from?: string | null; body: string }[]): string {
  return events.map((e) => `From: ${e.from ?? ""}\n${e.body}`).join("\n\n");
}
