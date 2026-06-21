type IconProps = {
  className?: string;
};

const base = "h-5 w-5";

export function LogoIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gspec" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#8A6BFF"></stop>
          <stop offset="1" stopColor="#2F80ED"></stop>
        </linearGradient>
      </defs>
      <path d="M26,106 L26,64 C26,34 41,15 60,15 C79,15 94,34 94,64 L94,106 Z" fill="url(#gspec)" opacity="0.26" transform="translate(60,70) scale(1.16) translate(-60,-70)"></path>
      <path d="M26,106 L26,64 C26,34 41,15 60,15 C79,15 94,34 94,64 L94,106 Z" fill="url(#gspec)" opacity="0.5" transform="translate(60,70) scale(0.94) translate(-60,-70)"></path>
      <path d="M26,106 L26,64 C26,34 41,15 60,15 C79,15 94,34 94,64 L94,106 Z" fill="url(#gspec)" transform="translate(60,70) scale(0.72) translate(-60,-70)"></path>
      <ellipse cx="60" cy="69.8" rx="11.5" ry="19.4" fill="#0B0D12" opacity="0.3"></ellipse>
      <circle cx="54.96" cy="55.6" r="2.45" fill="#E7DEFF"></circle>
      <circle cx="65.04" cy="55.6" r="2.45" fill="#E7DEFF"></circle>
    </svg>
  );
}

export function ContainersIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ImagesIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="15" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 14l4-4 3 3 4-5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function VolumesIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="6" rx="8" ry="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function NetworksIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="19" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="19" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.8 6.4 11 17M17.2 6.4 13 17M7 5h10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function LogsIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="3" width="16" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 8h9M7.5 12h9M7.5 16h5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TerminalIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9.5 10.5 12 7 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 14.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CopyIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function SettingsIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M5.8 18.2l1.4-1.4M16.8 7.2l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RefreshIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 11a8 8 0 0 1 13.7-5.4M20 13a8 8 0 0 1-13.7 5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M17.5 3.5v4h-4M6.5 20.5v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 10.5 12 15.5 17 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 18.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PlayIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 4.8v14.4a1 1 0 0 0 1.5.86l11-7.2a1 1 0 0 0 0-1.72l-11-7.2a1 1 0 0 0-1.5.86Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function StopIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function RestartIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12a8 8 0 1 0 2.5-5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 4v4.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 7h14M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckCircleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12.4l2.6 2.6L16 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function XCircleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AlertTriangleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4.5 21 19.5H3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 10.2v3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InfoCircleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="7.7" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DockerIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="2.6" height="2.6" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.4" y="10" width="2.6" height="2.6" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.8" y="10" width="2.6" height="2.6" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.4" y="6.6" width="2.6" height="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 14.5h13.6c0 2.5-2 4-4.6 4H8a5 5 0 0 1-5-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M16.6 13.6c1.1-1 2.1-.4 2.3 0 .6-.3 1.4-.2 1.6.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ServerIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="13.5" width="16" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 7.25h.01M7.5 16.75h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FirewallIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v5M15 9.5v5M9 14.5v5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function PlusIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function EyeIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function EyeOffIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5 4.5l15 15M3 12S6.5 6 12 6c1.5 0 2.9.3 4.1.85M21 12s-1.4 2.7-4 4.4M9.6 9.7a2.6 2.6 0 0 0 3.7 3.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10.5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="15" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LockOpenIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10.5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10.5V8a4 4 0 0 1 7.8-1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
