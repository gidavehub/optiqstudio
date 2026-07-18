import HomePortal from "./_views/HomePortal";

// /dashboard — the portal gateway. State lives in EditorFlowProvider (mounted
// in dashboard/layout.tsx); each stage is its own route.
export default function DashboardPage() {
  return <HomePortal />;
}
