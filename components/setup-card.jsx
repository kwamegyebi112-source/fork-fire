export default function SetupCard() {
  return (
    <article className="auth-card auth-card-compact">
      <p className="eyebrow">Setup Required</p>
      <h2 className="auth-card-title">Add your Supabase keys first</h2>
      <p className="auth-card-copy">
        Create a `.env.local` file from `.env.local.example`, then add your Supabase project URL
        and anon key before running or deploying the app.
      </p>

      <div className="setup-list">
        <div className="setup-row">
          <strong>1.</strong>
          <span>Copy `.env.local.example` to `.env.local`.</span>
        </div>
        <div className="setup-row">
          <strong>2.</strong>
          <span>Paste your Supabase URL and anon key.</span>
        </div>
        <div className="setup-row">
          <strong>3.</strong>
          <span>Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor.</span>
        </div>
        <div className="setup-row">
          <strong>4.</strong>
          <span>Create the owner account in Supabase Auth, then disable public signups.</span>
        </div>
      </div>
    </article>
  );
}
