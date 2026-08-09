"use client";

// Thin client bridge for /dashboard/project/[id]/board — same job as
// AgentRouteClient: tell the flow which project the URL points at, then hand off
// to the view. Same deck-turn animation, so arriving reads as flipping to
// another page of the same film.

import React, { useEffect } from "react";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import BoardShots from "./BoardShots";

export default function BoardRouteClient({ id }: { id: string }) {
  const { openProjectRoute } = useEditorFlow();

  useEffect(() => {
    openProjectRoute(id);
  }, [id, openProjectRoute]);

  return (
    <div className="animate-deck-next h-full">
      <BoardShots />
    </div>
  );
}
