import ImageDetailClient from "../_components/ImageDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

// /dashboard/image/[id] — detail view for a single generated still.
export default async function ImageDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ImageDetailClient id={id} />;
}
