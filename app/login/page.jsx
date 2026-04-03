import Image from "next/image";
import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import SetupCard from "@/components/setup-card";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-backdrop auth-backdrop-one" aria-hidden="true" />
      <div className="auth-backdrop auth-backdrop-two" aria-hidden="true" />

      <section className="auth-shell auth-shell-compact">
        <div className="auth-brand-stack">
          <Image
            src="/fork-n-fire-logo.png"
            alt="Fork N' Fire logo"
            width={92}
            height={92}
            priority
            className="auth-logo"
          />
          <h1 className="auth-brand-name">Fork N&apos; Fire</h1>
        </div>

        {hasSupabaseEnv ? <LoginForm /> : <SetupCard />}
      </section>
    </main>
  );
}
