"use client";

// Thin client bridge for /dashboard/project/[id]/agent — same job as
// ProjectRouteClient: tell the flow which project the URL points at, then hand
// off to the view. The deck-turn animation is what ties this to the script
// editor: arriving here reads as flipping to another page of the same film,
// not as leaving for a different app.

import React, { useEffect } from "react";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import AgentStudio from "./AgentStudio";

export default function AgentRouteClient({ id }: { id: string }) {
  const { openProjectRoute } = useEditorFlow();

  useEffect(() => {
    openProjectRoute(id);
  }, [id, openProjectRoute]);

  return (
    <div className="animate-deck-next h-full">
      <AgentStudio />
    </div>
  );
}
