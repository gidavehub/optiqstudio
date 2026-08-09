import BoardRouteClient from "../../../../_views/board/BoardRouteClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/project/story/[id]/board — the film's world as pictures.
//
// Only this tree has one. The board exists for exactly one film type, and the
// ad tree's copy of this route is a leftover from when it existed for all of
// them.
export default async function StoryBoardPage({ params }: PageProps) {
  const { id } = await params;
  return <BoardRouteClient id={id} />;
}
