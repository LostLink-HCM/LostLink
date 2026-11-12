import { LINE, YARN, YARN_LINE } from './theme'

// Lớp ngoài di chuyển theo nhịp, lớp trong lăn tròn
export default function Yarn() {
  return (
    <g className="group-data-[story=arrive]/scene:animate-auth-yarn-in group-data-[story=back]/scene:animate-auth-yarn-back group-data-[story=lose]/scene:animate-auth-yarn-lose-x group-data-[story=toss]/scene:animate-auth-yarn-toss">
      <g className="group-data-[story=lose]/scene:animate-auth-yarn-lose-y">
        <path
          d="M212 377 q14 5 26 -1"
          fill="none"
          stroke={YARN_LINE}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <g className="origin-[200px_368px] group-data-[story=arrive]/scene:animate-auth-yarn-in-roll group-data-[story=back]/scene:animate-auth-yarn-back-roll group-data-[story=lose]/scene:animate-auth-yarn-lose-roll group-data-[story=toss]/scene:animate-auth-yarn-toss-roll">
          <circle cx="200" cy="368" r="13.5" fill={YARN} stroke={LINE} strokeWidth="2.2" />
          <path
            d="M188 362 q12 -6 24 4 M190 374 q10 -14 22 -12 M195 356 q4 12 13 24"
            fill="none"
            stroke={YARN_LINE}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  )
}
