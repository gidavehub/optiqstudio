import StoryRouteClient from "../../../_views/story/StoryRouteClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/project/story/[id] — the experimental original story's own
// workspace. A separate tree from /dashboard/project/[id] because it is a
// separate product: three gated stages, photographed scenes, and a board. See
// projectHref() in app/dashboard/_flow/types.ts, which is the one place that
// decides which tree a project belongs to.
export default async function StoryProjectPage({ params }: PageProps) {
  const { id } = await params;
  return <StoryRouteClient id={id} />;
}
