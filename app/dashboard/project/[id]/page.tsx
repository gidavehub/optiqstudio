import DashboardHome from "../../page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <DashboardHome projectId={id} />;
}
