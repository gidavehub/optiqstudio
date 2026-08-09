"use client";

// Thin client bridge for /dashboard/project/story/[id] — the same job as
// ProjectRouteClient: tell the flow which project the URL points at, then hand
// off to the workspace, which reads it from context.

import React, { useEffect } from "react";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import StoryWorkspace from "./StoryWorkspace";

export default function StoryRouteClient({ id }: { id: string }) {
  const { openProjectRoute } = useEditorFlow();

  useEffect(() => {
    openProjectRoute(id);
  }, [id, openProjectRoute]);

  return <StoryWorkspace />;
}
