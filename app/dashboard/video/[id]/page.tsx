import VideoDetailClient from "../_components/VideoDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/video/[id] — detail view for a single generated video.
export default async function VideoDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <VideoDetailClient id={id} />;
}
