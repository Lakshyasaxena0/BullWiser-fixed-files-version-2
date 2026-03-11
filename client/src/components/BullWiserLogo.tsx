export const BullWiserLogo = ({ className = "w-10 h-10" }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 900 700"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Golden bull standing on green candlesticks with Saturn rings"
    >
      <defs>
        {/* Gold metallic gradient */}
        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e7c469"/>
          <stop offset="45%" stopColor="#b68a2a"/>
          <stop offset="100%" stopColor="#7a5a12"/>
        </linearGradient>

        {/* Green gradient for bullish candles */}
        <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2cab4f"/>
          <stop offset="100%" stopColor="#1f8a3b"/>
        </linearGradient>

        {/* Red gradient for bearish candle */}
        <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e05252"/>
          <stop offset="100%" stopColor="#b13a3a"/>
        </linearGradient>

        {/* Soft outer glow for gold    strokes */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge>
            <feMergeNode in="b"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* Subtle inner shadow for bars */}
        <filter id="innerShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feOffset dx="0" dy="2"/>
          <feGaussianBlur stdDeviation="2" result="off"/>
          <feComposite in="SourceGraphic" in2="off" operator="arithmetic" k2="-1" k3="1" result="shadow"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 .6 0"/>
        </filter>
      </defs>

      {/* Saturn rings (two golden ellipses wrapping the whole logo) */}
      <g id="rings" stroke="url(#goldGrad)" fill="none" strokeWidth="12" filter="url(#glow)">
        <ellipse cx="450" cy="350" rx="410" ry="250"/>
        <ellipse cx="450" cy="360" rx="440" ry="270" strokeWidth="8" opacity="0.7"/>
      </g>

      {/* Candlestick baseline */}
      <g id="grid">
        <line x1="120" y1="560" x2="780" y2="560" stroke="rgba(255,255,255,0.12)" strokeWidth="2"/>
      </g>

      {/* Candlesticks: small red (left), medium green (middle), large green (right) */}
      <g id="candles" strokeLinecap="round">
        {/* Left red: small */}
        <line x1="250" y1="520" x2="250" y2="590" stroke="url(#redGrad)" strokeWidth="8"/>
        <rect x="230" y="540" width="40" height="40" rx="6" fill="url(#redGrad)" filter="url(#innerShadow)"/>

        {/* Middle green: medium */}
        <line x1="400" y1="430" x2="400" y2="580" stroke="url(#greenGrad)" strokeWidth="8"/>
        <rect x="380" y="460" width="40" height="100" rx="6" fill="url(#greenGrad)" filter="url(#innerShadow)"/>

        {/* Right green: large */}
        <line x1="560" y1="330" x2="560" y2="580" stroke="url(#greenGrad)" strokeWidth="8"/>
        <rect x="540" y="360" width="40" height="200" rx="6" fill="url(#greenGrad)" filter="url(#innerShadow)"/>
      </g>

      {/* Golden bull (stylized, muscular; hind legs on last two candles) */}
      <g id="bull" transform="translate(210,130)" fill="url(#goldGrad)" stroke="#6a4a13" strokeWidth="2">
        {/* Body */}
        <ellipse cx="290" cy="220" rx="150" ry="90"/>
        {/* Neck/shoulder mass */}
        <path d="M250,185 C300,150 360,150 400,180 C420,195 420,215 395,230 C360,252 300,245 260,230 C240,220 235,200 250,185 Z"/>
        {/* Head */}
        <path d="M410,185 C440,180 470,185 485,205 C498,222 490,240 470,248 C450,256 420,250 408,235 C397,222 399,191 410,185 Z"/>
        {/* Eye */}
        <circle cx="462" cy="213" r="4" fill="#2b1b06"/>
        {/* Horns */}
        <path d="M430,175 C450,155 475,152 492,165 C480,161 462,168 452,180 Z" />
        <path d="M455,170 C475,152 505,150 520,165 C505,160 485,167 473,180 Z" />
        {/* Tail */}
        <path d="M175,215 C150,205 140,185 145,165 C150,150 160,142 170,146 C160,165 168,185 195,198" fill="none" stroke="url(#goldGrad)" strokeWidth="8" strokeLinecap="round"/>
        <circle cx="140" cy="162" r="8" fill="url(#goldGrad)"/>

        {/* Front legs (raised) */}
        <path d="M360,270 C365,245 380,230 400,230 L410,230 C425,230 430,240 426,255 L415,295"/>
        <rect x="410" y="290" width="16" height="50" rx="6"/>
        <rect x="395" y="275" width="14" height="40" rx="6" transform="rotate(-20 402 295)"/>

        {/* Hind legs placed on last two candles */}
        {/* Left hind on middle green candle top (x~400,y~460) */}
        <rect x="380" y="445" width="18" height="55" rx="6"/>
        {/* Right hind on large green candle top (x~560,y~360) */}
        <rect x="540" y="345" width="18" height="65" rx="6"/>
      </g>

      {/* Highlights on candle tops to suggest contact */}
      <g opacity="0.65">
        <rect x="380" y="460" width="40" height="10" fill="url(#goldGrad)" rx="3"/>
        <rect x="540" y="360" width="40" height="10" fill="url(#goldGrad)" rx="3"/>
      </g>
    </svg>
  );
};

export const BullWiserLogoLarge = ({ className = "w-20 h-20" }: { className?: string }) => {
  return <BullWiserLogo className={className} />;
};