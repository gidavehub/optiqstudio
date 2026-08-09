import BoardRouteClient from "../../../_views/board/BoardRouteClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/project/[id]/board — the film's world as pictures, in the hierarchy
// it was photographed in. Server component unwraps the route param, then hands
// off to the client bridge that activates the project in the flow context (same
// pattern as the agent route and the project route itself).
export default async function ProjectBoardPage({ params }: PageProps) {
  const { id } = await params;
  return <BoardRouteClient id={id} />;
}
