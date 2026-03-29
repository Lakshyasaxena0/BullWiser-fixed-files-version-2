import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Lock,
  BarChart2, Star, AlertTriangle, Clock, Calendar,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface SectorOutlook {
  sector: string; signal: string; strength: string; confidence: number;
  changeEstimate: number; rangeLow: number; rangeHigh: number;
  statsScore: number; astroScore: number;
  keyFactors: string[]; risks: string[];
  topStock: string; topStockChange: number;
  horizon: string; targetDate: string;
}

interface CryptoOutlook {
  symbol: string; name: string; signal: string; strength: string;
  confidence: number; changeEstimate: number; rangeLow: number; rangeHigh: number;
  currentPrice: number; statsScore: number; astroScore: number;
  keyFactors: string[]; risks: string[];
  horizon: string; targetDate: string;
}

interface OutlookData {
  generatedAt: string; horizon: string; targetDate: string;
  daysAhead: number; marketSummary: string;
  stocks?: { bullish: SectorOutlook[]; bearish: SectorOutlook[]; neutral: SectorOutlook[]; all: SectorOutlook[] };
  crypto?: { bullish: CryptoOutlook[]; bearish: CryptoOutlook[]; neutral: CryptoOutlook[]; all: CryptoOutlook[] };
  stocksLocked?: boolean; cryptoLocked?: boolean;
}

const HORIZONS = [
  { value: '1w',  label: '1 Week' },
  { value: '2w',  label: '2 Weeks' },
  { value: '3w',  label: '3 Weeks' },
  { value: '1m',  label: '1 Month' },
  { value: '2m',  label: '2 Months' },
  { value: '4m',  label: '4 Months' },
  { value: '6m',  label: '6 Months' },
  { value: '1y',  label: '1 Year' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const signalColor = (signal: string) =>
  signal === 'bullish' ? 'text-green-600' : signal === 'bearish' ? 'text-red-600' : 'text-gray-500';

const signalBg = (signal: string) =>
  signal === 'bullish' ? 'bg-green-50 border-green-200' : signal === 'bearish' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';

const signalBadge = (signal: string) =>
  signal === 'bullish' ? 'bg-green-100 text-green-800' : signal === 'bearish' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700';

const strengthBadge = (strength: string) =>
  strength === 'strong' ? 'bg-purple-100 text-purple-800' : strength === 'moderate' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600';

const SignalIcon = ({ signal }: { signal: string }) =>
  signal === 'bullish' ? <TrendingUp className="h-5 w-5 text-green-600" />
  : signal === 'bearish' ? <TrendingDown className="h-5 w-5 text-red-600" />
  : <Minus className="h-5 w-5 text-gray-400" />;

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

// ── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span><span>{value.toFixed(0)}/100</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Sector card ───────────────────────────────────────────────────────────────
function SectorCard({ item }: { item: SectorOutlook }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={`border ${signalBg(item.signal)} transition-shadow hover:shadow-md`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <SignalIcon signal={item.signal} />
            <div>
              <CardTitle className="text-base">{item.sector}</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Top: {item.topStock}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${signalColor(item.signal)}`}>{pct(item.changeEstimate)}</p>
            <p className="text-xs text-gray-400">expected</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          <Badge className={signalBadge(item.signal)}>{item.signal}</Badge>
          <Badge className={strengthBadge(item.strength)}>{item.strength}</Badge>
          <Badge variant="outline" className="text-xs">{item.confidence}% conf.</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Range */}
        <div className="flex justify-between text-xs bg-white rounded-lg p-2 border border-gray-100">
          <span className="text-red-500 font-medium">Low: {pct(item.rangeLow)}</span>
          <span className="text-gray-400">→</span>
          <span className="text-green-600 font-medium">High: {pct(item.rangeHigh)}</span>
        </div>

        {/* Score bars */}
        <div className="space-y-1.5">
          <ScoreBar label="Statistical" value={item.statsScore} color="bg-blue-500" />
          <ScoreBar label="Astrological" value={item.astroScore} color="bg-purple-500" />
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-500 hover:underline w-full text-left"
        >
          {expanded ? '▲ Hide details' : '▼ Show details'}
        </button>

        {expanded && (
          <div className="space-y-2">
            {item.keyFactors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Star className="h-3 w-3" /> Key Factors</p>
                <ul className="space-y-1">
                  {item.keyFactors.map((f, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1"><span className="text-blue-400 font-bold mt-0.5">→</span>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.risks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Risks</p>
                <ul className="space-y-1">
                  {item.risks.map((r, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1"><span className="font-bold mt-0.5">⚠</span>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Crypto card ───────────────────────────────────────────────────────────────
function CryptoCard({ item }: { item: CryptoOutlook }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={`border ${signalBg(item.signal)} transition-shadow hover:shadow-md`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <SignalIcon signal={item.signal} />
            <div>
              <CardTitle className="text-base">{item.symbol}</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">{item.name}{item.currentPrice > 0 ? ` · $${item.currentPrice.toLocaleString()}` : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${signalColor(item.signal)}`}>{pct(item.changeEstimate)}</p>
            <p className="text-xs text-gray-400">expected</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          <Badge className={signalBadge(item.signal)}>{item.signal}</Badge>
          <Badge className={strengthBadge(item.strength)}>{item.strength}</Badge>
          <Badge variant="outline" className="text-xs">{item.confidence}% conf.</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-xs bg-white rounded-lg p-2 border border-gray-100">
          <span className="text-red-500 font-medium">Low: {pct(item.rangeLow)}</span>
          <span className="text-gray-400">→</span>
          <span className="text-green-600 font-medium">High: {pct(item.rangeHigh)}</span>
        </div>
        <div className="space-y-1.5">
          <ScoreBar label="Statistical" value={item.statsScore} color="bg-blue-500" />
          <ScoreBar label="Astrological" value={item.astroScore} color="bg-purple-500" />
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-500 hover:underline w-full text-left">
          {expanded ? '▲ Hide details' : '▼ Show details'}
        </button>
        {expanded && (
          <div className="space-y-2">
            {item.keyFactors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Star className="h-3 w-3" />Key Factors</p>
                <ul className="space-y-1">{item.keyFactors.map((f, i) => <li key={i} className="text-xs text-gray-600 flex items-start gap-1"><span className="text-blue-400 font-bold">→</span>{f}</li>)}</ul>
              </div>
            )}
            {item.risks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Risks</p>
                <ul className="space-y-1">{item.risks.map((r, i) => <li key={i} className="text-xs text-amber-700 flex items-start gap-1"><span className="font-bold">⚠</span>{r}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketOutlook() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'stocks' | 'crypto'>('stocks');
  const [horizon, setHorizon] = useState('1m');
  const [data, setData] = useState<OutlookData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subError, setSubError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) { window.location.href = '/auth'; }
  }, [isAuthenticated, isLoading]);

  const fetchOutlook = async () => {
    setLoading(true); setError(null); setSubError(null);
    try {
      const res = await fetch(`/api/market/outlook?horizon=${horizon}&type=${activeTab}`, { credentials: 'include' });
      if (res.status === 403) {
        const body = await res.json();
        setSubError(body.message || 'Subscription required');
        setData(null); return;
      }
      if (!res.ok) throw new Error('Failed to fetch outlook');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error generating outlook');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // Auto-fetch when horizon or tab changes
  useEffect(() => { if (isAuthenticated) fetchOutlook(); }, [horizon, activeTab, isAuthenticated]);

  // ── Toggle ────────────────────────────────────────────────────────────────
  const Toggle = () => (
    <div className="space-y-2">
      <div
        className="relative flex items-center w-60 rounded-xl border border-gray-200 bg-gray-100 p-1 cursor-pointer select-none"
        onClick={() => setActiveTab(t => t === 'stocks' ? 'crypto' : 'stocks')}
      >
        <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-sm transition-all duration-300 ease-in-out
          ${activeTab === 'stocks' ? 'left-1 bg-blue-600' : 'left-[calc(50%+3px)] bg-orange-500'}`} />
        <div className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors duration-300
          ${activeTab === 'stocks' ? 'text-white' : 'text-gray-400'}`}>
          <TrendingUp className="h-3.5 w-3.5" />Stocks
        </div>
        <div className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors duration-300
          ${activeTab === 'crypto' ? 'text-white' : 'text-gray-400'}`}>
          <span className="font-bold text-xs">₿</span>Crypto
        </div>
      </div>
    </div>
  );

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Outlook</h1>
          <p className="text-gray-500 text-sm">Generating {horizon} forecast…</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader><div className="h-5 bg-gray-200 rounded w-2/3 mb-2" /><div className="h-4 bg-gray-100 rounded w-1/2" /></CardHeader>
            <CardContent><div className="h-16 bg-gray-100 rounded" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-blue-600" />Market Outlook
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Sector & crypto trend forecast using Statistical Analysis + Vedic Astrology (50/50)</p>
        </div>
        <Button onClick={fetchOutlook} variant="outline" size="sm" className="gap-2 self-start sm:self-auto" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {/* ── Controls ── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Toggle />
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2 font-medium">Time Horizon</p>
              <div className="flex flex-wrap gap-1.5">
                {HORIZONS.map(h => (
                  <button key={h.value} onClick={() => setHorizon(h.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                      ${horizon === h.value
                        ? activeTab === 'stocks' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 border-t pt-3">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Generated: {new Date(data.generatedAt).toLocaleTimeString('en-IN')}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Target: {new Date(data.targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Subscription wall ── */}
      {subError && (
        <Card className="border-2 border-dashed border-amber-300 bg-amber-50">
          <CardContent className="py-12 text-center space-y-4">
            <Lock className="h-10 w-10 text-amber-500 mx-auto" />
            <h3 className="text-lg font-semibold text-amber-900">Subscription Required</h3>
            <p className="text-amber-700 text-sm max-w-md mx-auto">{subError}</p>
            <Button className="mt-2" onClick={() => window.location.href = '/plans'}>View Plans</Button>
          </CardContent>
        </Card>
      )}

      {/* ── Error ── */}
      {error && !subError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-center text-red-700 text-sm">{error}</CardContent>
        </Card>
      )}

      {/* ── Market summary ── */}
      {data?.marketSummary && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3 px-4 text-sm text-blue-800">{data.marketSummary}</CardContent>
        </Card>
      )}

      {/* ── STOCKS view ── */}
      {activeTab === 'stocks' && data?.stocks && (
        <div className="space-y-6">
          {/* Bullish sectors */}
          {data.stocks.bullish.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-green-700 flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5" />Bullish Sectors ({data.stocks.bullish.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.stocks.bullish.map(s => <SectorCard key={s.sector} item={s} />)}
              </div>
            </div>
          )}

          {/* Bearish sectors */}
          {data.stocks.bearish.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2 mb-3">
                <TrendingDown className="h-5 w-5" />Bearish Sectors ({data.stocks.bearish.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.stocks.bearish.map(s => <SectorCard key={s.sector} item={s} />)}
              </div>
            </div>
          )}

          {/* Neutral sectors */}
          {data.stocks.neutral.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-600 flex items-center gap-2 mb-3">
                <Minus className="h-5 w-5" />Neutral Sectors ({data.stocks.neutral.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.stocks.neutral.map(s => <SectorCard key={s.sector} item={s} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CRYPTO view ── */}
      {activeTab === 'crypto' && data?.crypto && (
        <div className="space-y-6">
          {data.crypto.bullish.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-green-700 flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5" />Bullish Crypto ({data.crypto.bullish.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.crypto.bullish.map(c => <CryptoCard key={c.symbol} item={c} />)}
              </div>
            </div>
          )}
          {data.crypto.bearish.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2 mb-3">
                <TrendingDown className="h-5 w-5" />Bearish Crypto ({data.crypto.bearish.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.crypto.bearish.map(c => <CryptoCard key={c.symbol} item={c} />)}
              </div>
            </div>
          )}
          {data.crypto.neutral.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-600 flex items-center gap-2 mb-3">
                <Minus className="h-5 w-5" />Neutral Crypto ({data.crypto.neutral.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.crypto.neutral.map(c => <CryptoCard key={c.symbol} item={c} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Locked state ── */}
      {activeTab === 'stocks' && data?.stocksLocked && (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="py-10 text-center space-y-3">
            <Lock className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-gray-600 font-medium">Stock sector outlook requires an active stock subscription</p>
            <Button size="sm" onClick={() => window.location.href = '/plans'}>Get Stock Plan</Button>
          </CardContent>
        </Card>
      )}
      {activeTab === 'crypto' && data?.cryptoLocked && (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="py-10 text-center space-y-3">
            <Lock className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-gray-600 font-medium">Crypto outlook requires an active crypto subscription</p>
            <Button size="sm" onClick={() => window.location.href = '/plans'}>Get Crypto Plan</Button>
          </CardContent>
        </Card>
      )}

      {/* ── Disclaimer ── */}
      <p className="text-xs text-gray-400 text-center pb-4">
        BullWiser outlook combines statistical analysis (RSI, MACD, Moving Averages) and Vedic astrology in a 50/50 model.
        This is not financial advice. Always do your own research before investing.
      </p>
    </div>
  );
}
