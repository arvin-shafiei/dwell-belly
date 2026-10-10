import { Suspense } from "react";
import type { Flow } from "../../../api/src/lib/flow";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getFlows(): Promise<Flow[] | null> {
  try {
    const res = await fetch(`${API}/api/flows`, { cache: "no-store" });
    return (await res.json()).flows;
  } catch {
    return null;
  }
}

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Delivery Ops Control Room</h1>
      <p className="mt-2 text-zinc-500">Flowchart UI goes here (React Flow).</p>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Loading flows…</p>}>
        <FlowList />
      </Suspense>
    </main>
  );
}

async function FlowList() {
  const flows = await getFlows();
  return flows === null ? (
    <p className="mt-6 text-red-600">
      API not reachable at {API}. Run <code>npm run dev</code> from the repo
      root.
    </p>
  ) : (
    flows.map((flow) => (
      <section key={flow.id} className="mt-6">
        <h2 className="font-medium">{flow.name}</h2>
        <ol className="mt-2 list-decimal pl-6 text-sm">
          {flow.nodes.map((n) => (
            <li key={n.id}>
              {n.type}{" "}
              <span className="text-zinc-500">({n.runs_on.join(" + ")})</span>
            </li>
          ))}
        </ol>
      </section>
    ))
  );
}
