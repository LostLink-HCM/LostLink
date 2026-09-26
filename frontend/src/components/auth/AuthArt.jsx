export default function AuthArt() {
  return (
    <div className="relative flex h-[240px] scale-[1.02] items-center justify-center">
      <div className="absolute size-[260px] rounded-full bg-[radial-gradient(circle,rgba(78,139,224,.24),rgba(78,139,224,0)_68%)] motion-safe:animate-ll-glow-fast" />

      <div className="relative size-[200px]">
        <div className="absolute inset-[24px] rounded-full border border-[rgba(110,168,255,.55)] motion-safe:animate-ll-burst motion-reduce:hidden" />
        <div className="absolute inset-[24px] rounded-full border border-white/28 [animation-delay:.16s] motion-safe:animate-ll-burst motion-reduce:hidden" />

        <div className="absolute -inset-[14px] motion-safe:animate-ll-sweep motion-reduce:hidden">
          <div className="absolute left-1/2 top-0 -ml-[3px] size-[6px] rounded-full bg-white/70 shadow-[0_0_10px_3px_rgba(110,168,255,.45)]" />
        </div>

        <div className="absolute left-[86px] top-[85px] h-[2px] w-[126px] origin-left bg-[linear-gradient(90deg,rgba(169,204,255,.9),rgba(169,204,255,0))] [--a:-22.3deg] motion-safe:animate-ll-tether motion-reduce:hidden" />
        <div className="absolute left-[86px] top-[85px] h-[2px] w-[108px] origin-left bg-[linear-gradient(90deg,rgba(255,255,255,.7),rgba(255,255,255,0))] [--a:160.5deg] motion-safe:animate-ll-tether motion-reduce:hidden" />
        <div className="absolute left-[70px] top-[70px] size-[32px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.95),rgba(169,204,255,0)_70%)] motion-safe:animate-ll-snap motion-reduce:hidden" />

        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          className="absolute inset-0 motion-safe:animate-ll-lens-in"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="llLensG"
              x1="20"
              y1="14"
              x2="176"
              y2="182"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#A9CCFF" />
              <stop offset="1" stopColor="#3B76D6" />
            </linearGradient>
          </defs>
          <circle
            cx="86"
            cy="86"
            r="62"
            stroke="rgba(255,255,255,.13)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray="58 390"
            strokeDashoffset="-306"
            transform="rotate(-52 86 86)"
          />
          <circle
            cx="86"
            cy="86"
            r="62"
            stroke="url(#llLensG)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray="292 390"
            transform="rotate(-52 86 86)"
            className="motion-safe:animate-ll-trace"
          />
          <path
            d="M131.5 131.5 L174 174"
            stroke="url(#llLensG)"
            strokeWidth="12"
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute left-[86px] top-[86px] motion-safe:animate-ll-pin-in">
          <svg
            width="76"
            height="76"
            viewBox="0 0 24 24"
            fill="none"
            className="-ml-[38px] -mt-[42px] block"
            aria-hidden="true"
          >
            <path
              d="M12 22.2c0 0 7.5-7.6 7.5-12.7A7.5 7.5 0 0 0 4.5 9.5c0 5.1 7.5 12.7 7.5 12.7Z"
              fill="#fff"
            />
            <circle cx="12" cy="9.5" r="3.4" fill="none" stroke="#2B5FAE" strokeWidth="1.9" />
            <circle cx="12" cy="9.5" r="1" fill="#2B5FAE" />
          </svg>
        </div>
      </div>
    </div>
  )
}
