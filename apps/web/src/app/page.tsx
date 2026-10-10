import { Suspense } from "react";
import Shell from "@/console/Shell";
import { RivetMark } from "@/console/ui/icons";

// Rivet desk console. The Shell reads `?tab=` (useSearchParams), so it lives inside <Suspense>
// (Next 16: URL data outside a Suspense boundary blocks prerendering).
export default function Home() {
  return (
    <Suspense fallback={<ConsoleFallback />}>
      <Shell />
    </Suspense>
  );
}

function ConsoleFallback() {
  return (
    <div className="console-root flex h-dvh w-full">
      <div className="flex w-[60px] shrink-0 justify-center border-r border-white/[0.07] bg-rv-sidebar pt-3">
        <RivetMark size={26} />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-[52px] border-b border-white/[0.07]" />
        <div className="rv-dotgrid flex-1" />
      </div>
    </div>
  );
}
