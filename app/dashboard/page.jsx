import { redirect } from "next/navigation";
import DashboardApp from "@/components/dashboard-app";
import SetupCard from "@/components/setup-card";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!hasSupabaseEnv) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-backdrop dashboard-backdrop-one" aria-hidden="true" />
        <div className="dashboard-backdrop dashboard-backdrop-two" aria-hidden="true" />
        <section className="dashboard-shell">
          <SetupCard />
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-backdrop dashboard-backdrop-one" aria-hidden="true" />
      <div className="dashboard-backdrop dashboard-backdrop-two" aria-hidden="true" />
      <DashboardApp
        userEmail={user.email ?? "Owner"}
        displayName={user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Owner"}
      />
    </main>
  );
}
