import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
