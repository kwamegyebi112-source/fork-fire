export default function SetupCard() {
  return (
    <article className="auth-card auth-card-compact">
      <p className="eyebrow">Setup Required</p>
      <h2 className="auth-card-title">Add Supabase keys</h2>
      <p className="auth-card-copy">
        Copy `.env.local.example`, add your project URL and anon key, then run the schema once.
      </p>

      <div className="setup-list">
        <div className="setup-row">
          <strong>1.</strong>
          <span>Copy `.env.local.example` to `.env.local`.</span>
        </div>
        <div className="setup-row">
          <strong>2.</strong>
          <span>Add your Supabase URL and anon key.</span>
        </div>
        <div className="setup-row">
          <strong>3.</strong>
          <span>Run `supabase/schema.sql` in the Supabase SQL editor.</span>
        </div>
        <div className="setup-row">
          <strong>4.</strong>
          <span>Create the owner account and disable public signups.</span>
        </div>
      </div>
    </article>
  );
}
