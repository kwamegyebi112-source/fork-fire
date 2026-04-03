import Image from "next/image";

const logoutIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M14 16L18 12M18 12L14 8M18 12H9M11 4H7C5.89543 4 5 4.89543 5 6V18C5 19.1046 5.89543 20 7 20H11"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Topbar({ displayName, subtitle, busyAction, onLogout }) {
  const initial = (displayName || "O").trim().charAt(0).toUpperCase();

  return (
    <header className="tracker-topbar">
      <div className="tracker-brand">
        <Image
          src="/fork-n-fire-logo.png"
          alt="Fork N' Fire logo"
          width={52}
          height={52}
          className="tracker-brand-logo"
          priority
        />
        <div className="tracker-brand-copy">
          <h1>Fork N&apos; Fire</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="tracker-user">
        <div className="tracker-avatar" aria-hidden="true">
          <span>{initial}</span>
        </div>
        <button
          className="tracker-icon-button"
          type="button"
          onClick={onLogout}
          aria-label="Sign out"
          disabled={busyAction === "logout"}
        >
          {logoutIcon}
        </button>
      </div>
    </header>
  );
}
