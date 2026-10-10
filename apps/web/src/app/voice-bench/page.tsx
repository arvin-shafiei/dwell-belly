import { Suspense } from "react";
import { VoiceBench } from "../../voice/VoiceBench";

// Unlinked developer bench for the voice layer: rehearse case 003 end to end (voice note, re-run,
// call, approve by voice) before the components are mounted in the desk console.
export default function VoiceBenchPage() {
  return (
    <Suspense fallback={<p className="p-6 text-white/60">Loading voice bench…</p>}>
      <VoiceBench />
    </Suspense>
  );
}
