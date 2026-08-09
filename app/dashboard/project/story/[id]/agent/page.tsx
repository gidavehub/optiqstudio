import AgentRouteClient from "../../../../_views/agent/AgentRouteClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/project/story/[id]/agent — the blueprint agent.
//
// Deliberately the SAME client as the ad tree's agent route: the agent screen is
// a chat window over a project, and which swarm answers is decided server-side by
// filmSandbox(videoType), not by which URL the director arrived from.
export default async function StoryAgentPage({ params }: PageProps) {
  const { id } = await params;
  return <AgentRouteClient id={id} />;
}
