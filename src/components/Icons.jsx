// ─── Icons as inline SVG components ───
const Icon = ({ d, size = 20, color = "currentColor", children, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {d && <path d={d} />}
        {children}
    </svg>
);

const Icons = {
    search: (p) => <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" {...p} />,
    plus: (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>,
    heart: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill={p?.filled ? p?.color || "#e74c6f" : "none"} stroke={p?.color || "#e74c6f"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    ),
    back: (p) => <Icon d="M19 12H5m7-7l-7 7 7 7" {...p} />,
    edit: (p) => <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" {...p}><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></Icon>,
    trash: (p) => <Icon d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" {...p} />,
    clock: (p) => <Icon d="M12 2a10 10 0 100 20 10 10 0 000-20z" {...p}><path d="M12 6v6l4 2" /></Icon>,
    list: (p) => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} />,
    scale: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
        </svg>
    ),
    chef: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6V13.87Z" />
            <line x1="6" y1="17" x2="18" y2="17" />
        </svg>
    ),
    cart: (p) => <Icon d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" {...p}><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></Icon>,
    calendar: (p) => <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" {...p} />,
    check: (p) => <Icon d="M20 6L9 17l-5-5" {...p} />,
    x: (p) => <Icon d="M18 6L6 18M6 6l12 12" {...p} />,
    filter: (p) => <Icon d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" {...p} />,
    star: (p) => (
        <svg width={p?.size || 16} height={p?.size || 16} viewBox="0 0 24 24" fill={p?.filled ? "#f6b93b" : "none"} stroke="#f6b93b" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ),
    suggest: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    camera: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
        </svg>
    ),
    sun: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
    ),
    moon: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
    ),
    upload: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    ),
    link: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
    ),
    stats: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill="none" stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="12" width="4" height="9" rx="1" />
            <rect x="10" y="6" width="4" height="15" rx="1" />
            <rect x="17" y="2" width="4" height="19" rx="1" />
        </svg>
    ),
    fire: (p) => (
        <svg width={p?.size || 20} height={p?.size || 20} viewBox="0 0 24 24" fill={p?.filled ? p?.color || "#e74c3c" : "none"} stroke={p?.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 23c-3.866 0-7-3.134-7-7 0-3 2-6 4-8 0 3 2 4 3 4 0-3 1.5-6 4-9 1 2 3 5 3 9 0 1-.5 3-1 4 1-1 2-2.5 2-4 .5 1.5 1 3 1 5 0 3.866-3.134 6-9 6z" />
        </svg>
    ),
};

export default Icons;
