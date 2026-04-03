const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 10.5L12 4L20 10.5V20H14.5V14H9.5V20H4V10.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "sales",
    label: "Sales",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 10H20" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    id: "expenses",
    label: "Expenses",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="6" y="4" width="12" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 9H15M9 13H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomNav({ activeView, onChange }) {
  return (
    <div className="tracker-bottom-dock">
      <nav className="tracker-bottom-nav" aria-label="Dashboard sections">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`tracker-bottom-nav-item ${activeView === item.id ? "is-active" : ""}`}
            type="button"
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
