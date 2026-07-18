import ProjectRouteClient from "../../_views/ProjectRouteClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/project/[id] — the editor workspace (timeline theater ⇄ script
// editor). Server component unwraps the route param, then hands off to a client
// bridge that activates the project in the flow context.
export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ProjectRouteClient id={id} />;
}
