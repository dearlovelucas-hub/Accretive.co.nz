import { Suspense } from "react";
import DraftingWorkspace from "@/components/dashboard/DraftingWorkspace";

export default function DraftingPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading workspace...</div>}>
      <DraftingWorkspace />
    </Suspense>
  );
}
