import AudioDetailClient from "../_components/AudioDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/audio/[id] — detail view for a single voiceover take.
export default async function AudioDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <AudioDetailClient id={id} />;
}
