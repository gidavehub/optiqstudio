"use client";

import React, { useEffect } from "react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import ProjectWorkspace from "./ProjectWorkspace";

// Thin client bridge for /dashboard/project/[id]: tells the flow which project
// the URL is pointing at, then renders the workspace (which reads it from
// context). The provider handles loading/activating that project.
export default function ProjectRouteClient({ id }: { id: string }) {
  const { openProjectRoute } = useEditorFlow();

  useEffect(() => {
    openProjectRoute(id);
  }, [id, openProjectRoute]);

  return <ProjectWorkspace />;
}
