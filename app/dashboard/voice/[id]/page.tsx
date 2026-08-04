import AudioDetailClient from "../../_shared/audio/AudioDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/voice/[id] — detail view for a single voiceover take.
export default async function AudioDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <AudioDetailClient id={id} />;
}
