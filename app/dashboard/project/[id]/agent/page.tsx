import AgentRouteClient from "../../../_views/agent/AgentRouteClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/project/[id]/agent — the storyline agent. Server component unwraps
// the route param, then hands off to the client bridge that activates the
// project in the flow context (same pattern as the project route itself).
export default async function ProjectAgentPage({ params }: PageProps) {
  const { id } = await params;
  return <AgentRouteClient id={id} />;
}
