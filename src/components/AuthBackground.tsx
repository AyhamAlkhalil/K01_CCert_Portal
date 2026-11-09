const PAPERS = [
  { left: 6, delay: -4, duration: 46, size: 44, rotation: 12 },
  { left: 22, delay: -31, duration: 58, size: 60, rotation: -18 },
  { left: 38, delay: -12, duration: 52, size: 36, rotation: 24 },
  { left: 54, delay: -40, duration: 64, size: 52, rotation: -8 },
  { left: 68, delay: -22, duration: 48, size: 40, rotation: 16 },
  { left: 84, delay: -50, duration: 60, size: 56, rotation: -22 },
];

export default function AuthBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(221,72%,34%)] via-[hsl(220,62%,19%)] to-[hsl(216,58%,10%)]" />
      <div className="absolute -left-1/4 -top-1/4 h-[70%] w-[90%] rounded-full bg-[hsl(199,89%,55%)] opacity-[0.24] blur-[110px]" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[60%] w-[70%] rounded-full bg-[hsl(174,72%,50%)] opacity-[0.18] blur-[110px]" />

      {PAPERS.map((paper) => (
        <div
          key={paper.left}
          className="absolute animate-float-paper"
          style={{
            left: `${paper.left}%`,
            animationDelay: `${paper.delay}s`,
            animationDuration: `${paper.duration}s`,
          }}
        >
          <svg
            width={paper.size}
            height={paper.size * 1.4}
            viewBox="0 0 40 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ transform: `rotate(${paper.rotation}deg)` }}
          >
            <path
              d="M0 4C0 1.79086 1.79086 0 4 0H28L40 12V52C40 54.2091 38.2091 56 36 56H4C1.79086 56 0 54.2091 0 52V4Z"
              fill="hsl(210, 40%, 98%)"
            />
            <path d="M28 0L40 12H32C29.7909 12 28 10.2091 28 8V0Z" fill="hsl(210, 30%, 85%)" />
            <rect x="6" y="18" width="28" height="2" rx="1" fill="hsl(220, 30%, 75%)" />
            <rect x="6" y="24" width="24" height="2" rx="1" fill="hsl(220, 30%, 75%)" />
            <rect x="6" y="30" width="26" height="2" rx="1" fill="hsl(220, 30%, 75%)" />
            <rect x="6" y="36" width="20" height="2" rx="1" fill="hsl(220, 30%, 75%)" />
            <rect x="6" y="42" width="22" height="2" rx="1" fill="hsl(220, 30%, 75%)" />
          </svg>
        </div>
      ))}
    </div>
  );
}
