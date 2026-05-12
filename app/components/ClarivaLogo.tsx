export default function ClarivaLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", margin: "0 auto" }}
    >
      <rect width="100" height="100" rx="16" fill="#0e0b1a" />
      <path
        d="M 72 22 A 32 32 0 1 0 72 78"
        stroke="#c4b5fd"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 72 22 A 32 32 0 1 0 72 78"
        stroke="#0e0b1a"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 72 32 A 22 22 0 1 0 72 68"
        stroke="#f0c060"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 72 32 A 22 22 0 1 0 72 68"
        stroke="#0e0b1a"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 72 40 A 14 14 0 1 0 72 60"
        stroke="#a78bfa"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="72" cy="22" r="4" fill="#f0c060" />
      <circle cx="72" cy="78" r="4" fill="#f0c060" />
    </svg>
  );
}
