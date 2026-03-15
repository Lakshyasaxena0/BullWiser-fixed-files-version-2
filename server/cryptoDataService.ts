import axios from 'axios';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export interface CryptoQuote {
  symbol: string;
  name: string;
  lastPrice: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
  astrologyBias?: number;
  horaInfluence?: string;
  adjustedPrice?: number;
}

export interface CryptoOverview {
  totalMarketCap: number;
  totalVolume: number;
  marketCapChange24h: number;
  topGainers: CryptoQuote[];
  topLosers: CryptoQuote[];
  mostActive: CryptoQuote[];
}

const FINNHUB_SYMBOL_MAP: Record<string, string> = {
  'BTC':   'BINANCE:BTCUSDT',
  'ETH':   'BINANCE:ETHUSDT',
  'BNB':   'BINANCE:BNBUSDT',
  'ADA':   'BINANCE:ADAUSDT',
  'SOL':   'BINANCE:SOLUSDT',
  'XRP':   'BINANCE:XRPUSDT',
  'DOT':   'BINANCE:DOTUSDT',
  'MATIC': 'BINANCE:MATICUSDT',
  'AVAX':  'BINANCE:AVAXUSDT',
  'ATOM':  'BINANCE:ATOMUSDT',
  'LINK':  'BINANCE:LINKUSDT',
  'UNI':   'BINANCE:UNIUSDT',
  'LTC':   'BINANCE:LTCUSDT',
  'BCH':   'BINANCE:BCHUSDT',
  'ALGO':  'BINANCE:ALGOUSDT',
  'VET':   'BINANCE:VETUSDT',
  'FIL':   'BINANCE:FILUSDT',
  'DOGE':  'BINANCE:DOGEUSDT',
  'SHIB':  'BINANCE:SHIBUSDT',
  'TRX':   'BINANCE:TRXUSDT',
  'NEAR':  'BINANCE:NEARUSDT',
  'APT':   'BINANCE:APTUSDT',
  'ARB':   'BINANCE:ARBUSDT',
  'OP':    'BINANCE:OPUSDT',
  'INJ':   'BINANCE:INJUSDT',
  'SUI':   'BINANCE:SUIUSDT',
};

const CRYPTO_NAMES: Record<string, string> = {
  'BTC':   'Bitcoin',
  'ETH':   'Ethereum',
  'BNB':   'BNB',
  'ADA':   'Cardano',
  'SOL':   'Solana',
  'XRP':   'XRP',
  'DOT':   'Polkadot',
  'MATIC': 'Polygon',
  'AVAX':  'Avalanche',
  'ATOM':  'Cosmos',
  'LINK':  'Chainlink',
  'UNI':   'Uniswap',
  'LTC':   'Litecoin',
  'BCH':   'Bitcoin Cash',
  'ALGO':  'Algorand',
  'VET':   'VeChain',
  'FIL':   'Filecoin',
  'DOGE':  'Dogecoin',
  'SHIB':  'Shiba Inu',
  'TRX':   'TRON',
  'NEAR':  'NEAR Protocol',
  'APT':   'Aptos',
  'ARB':   'Arbitrum',
  'OP':    'Optimism',
  'INJ':   'Injective',
  'SUI':   'Sui',
};

function calculateCryptoAstrologyBias(symbol: string): { bias: number; hora: string } {
  const hour = new Date().getHours();
  const horaRulers = [
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury'
  ];
  const currentHora = horaRulers[hour];
  const cryptoInfluence: Record<string, { base: number; volatility: number }> = {
    'BTC':   { base: 2, volatility: 1.2 },
    'ETH':   { base: 1, volatility: 1.1 },
    'BNB':   { base: 0, volatility: 0.9 },
    'ADA':   { base: 1, volatility: 0.8 },
    'SOL':   { base: 2, volatility: 1.3 },
    'XRP':   { base: -1, volatility: 1.1 },
    'DOT':   { base: 1, volatility: 1.0 },
    'MATIC': { base: 1, volatility: 0.9 },
    'AVAX':  { base: 1, volatility: 1.2 },
    'ATOM':  { base: 0, volatility: 1.0 },
  };
  const cryptoData = cryptoInfluence[symbol] || { base: 0, volatility: 1.0 };
  const symbolHash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const horaIndex = horaRulers.indexOf(currentHora);
  let bias = ((symbolHash * horaIndex) % 11) - 5 + cryptoData.base;
  switch (currentHora) {
    case 'Jupiter': bias += Math.random() > 0.5 ? 2 : 1; break;
    case 'Venus':   bias += Math.random() > 0.6 ? 1 : 0; break;
    case 'Saturn':  bias -= Math.random() > 0.5 ? 2 : 1; break;
    case 'Mars':    bias += Math.random() > 0.5 ? 2 : -2; break;
    case 'Mercury': bias += Math.random() > 0.7 ? 1 : 0; break;
    case 'Moon':    bias += (Math.random() - 0.5) * 3; break;
    case 'Sun':     bias += Math.random() > 0.6 ? 1 : 0; break;
  }
  bias *= cryptoData.volatility;
  bias = Math.max(-5, Math.min(5, Math.round(bias)));
  return { bias, hora: currentHora };
}

function applyCryptoAstrologyBias(quote: CryptoQuote): CryptoQuote {
  const { bias, hora } = calculateCryptoAstrologyBias(quote.symbol);
  const biasMultiplier = 1 + (bias * 0.005);
  return {
    ...quote,
    astrologyBias: bias,
    horaInfluence: hora,
    adjustedPrice: Math.round(quote.lastPrice * biasMultiplier * 100) / 100,
  };
}

export class CryptoDataService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 60000;

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    return Boolean(cached && (Date.now() - cached.timestamp) < this.CACHE_TTL);
  }

  private getCachedData(key: string): any {
    return this.cache.get(key)?.data ?? null;
  }

  private setCacheData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getCryptoQuote(symbol: string): Promise<CryptoQuote | null> {
    const cacheKey = `crypto_quote_${symbol}`;
    if (this.isCacheValid(cacheKey)) return this.getCachedData(cacheKey);
    const finnhubSymbol = FINNHUB_SYMBOL_MAP[symbol.toUpperCase()];
    if (!finnhubSymbol) return null;
    try {
      const [quoteRes, candleRes] = await Promise.all([
        axios.get(`${FINNHUB_BASE_URL}/quote`, {
          params: { symbol: finnhubSymbol, token: FINNHUB_API_KEY },
          timeout: 10000,
        }),
        axios.get(`${FINNHUB_BASE_URL}/crypto/candle`, {
          params: {
            symbol: finnhubSymbol,
            resolution: 'D',
            from: Math.floor(Date.now() / 1000) - 86400,
            to: Math.floor(Date.now() / 1000),
            token: FINNHUB_API_KEY,
          },
          timeout: 10000,
        }),
      ]);
      const q = quoteRes.data;
      const c = candleRes.data;
      if (!q || q.c === 0) return null;
      const quote: CryptoQuote = {
        symbol: symbol.toUpperCase(),
        name: CRYPTO_NAMES[symbol.toUpperCase()] || symbol.toUpperCase(),
        lastPrice: q.c,
        change24h: q.d ?? 0,
        changePercent24h: q.dp ?? 0,
        volume24h: c?.v?.[0] ?? 0,
        marketCap: 0,
        high24h: c?.h?.[0] ?? q.h ?? q.c,
        low24h:  c?.l?.[0] ?? q.l ?? q.c,
        timestamp: new Date(),
      };
      const biasedQuote = applyCryptoAstrologyBias(quote);
      this.setCacheData(cacheKey, biasedQuote);
      return biasedQuote;
    } catch (error) {
      console.error(`Error fetching Finnhub quote for ${symbol}:`, error);
      return null;
    }
  }

  async getCryptoOverview(): Promise<CryptoOverview> {
    const cacheKey = 'crypto_overview';
    if (this.isCacheValid(cacheKey)) return this.getCachedData(cacheKey);
    try {
      const topSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'AVAX', 'LINK'];
      const quotes = (await Promise.all(topSymbols.map(s => this.getCryptoQuote(s)))).filter(Boolean) as CryptoQuote[];
      const sortedByChange = [...quotes].sort((a, b) => (b.changePercent24h || 0) - (a.changePercent24h || 0));
      const sortedByVolume = [...quotes].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
      const totalVolume = quotes.reduce((sum, q) => sum + (q.volume24h || 0), 0);
      const overview: CryptoOverview = {
        totalMarketCap: 0,
        totalVolume,
        marketCapChange24h: quotes[0]?.changePercent24h ?? 0,
        topGainers: sortedByChange.slice(0, 5),
        topLosers: sortedByChange.slice(-5).reverse(),
        mostActive: sortedByVolume.slice(0, 5),
      };
      this.setCacheData(cacheKey, overview);
      return overview;
    } catch (error) {
      console.error('Error fetching crypto overview:', error);
      return { totalMarketCap: 0, totalVolume: 0, marketCapChange24h: 0, topGainers: [], topLosers: [], mostActive: [] };
    }
  }

  async getCryptoHistoricalData(symbol: string, days: number = 30): Promise<any[]> {
    const cacheKey = `crypto_historical_${symbol}_${days}`;
    if (this.isCacheValid(cacheKey)) return this.getCachedData(cacheKey);
    const finnhubSymbol = FINNHUB_SYMBOL_MAP[symbol.toUpperCase()];
    if (!finnhubSymbol) return [];
    try {
      const to   = Math.floor(Date.now() / 1000);
      const from = to - days * 86400;
      const response = await axios.get(`${FINNHUB_BASE_URL}/crypto/candle`, {
        params: { symbol: finnhubSymbol, resolution: 'D', from, to, token: FINNHUB_API_KEY },
        timeout: 15000,
      });
      const data = response.data;
      if (!data || data.s === 'no_data' || !data.t) return [];
      const { bias } = calculateCryptoAstrologyBias(symbol);
      const biasMultiplier = 1 + (bias * 0.002);
      const historicalData = data.t.map((timestamp: number, i: number) => ({
        date:      new Date(timestamp * 1000),
        open:      (data.o?.[i] ?? 0) * biasMultiplier,
        high:      (data.h?.[i] ?? 0) * biasMultiplier,
        low:       (data.l?.[i] ?? 0) * biasMultiplier,
        close:     (data.c?.[i] ?? 0) * biasMultiplier,
        volume:    data.v?.[i] ?? 0,
        marketCap: 0,
      }));
      this.setCacheData(cacheKey, historicalData);
      return historicalData;
    } catch (error) {
      console.error(`Error fetching Finnhub historical data for ${symbol}:`, error);
      return [];
    }
  }

  async searchCryptos(query: string): Promise<CryptoQuote[]> {
    try {
      const allCryptos = Object.entries(CRYPTO_NAMES).map(([symbol, name]) => ({ symbol, name }));
      const queryLower = query.toLowerCase().trim();
      const matched = allCryptos
        .filter(({ symbol, name }) =>
          symbol.toLowerCase().includes(queryLower) || name.toLowerCase().includes(queryLower)
        )
        .sort((a, b) => {
          if (a.symbol.toLowerCase() === queryLower) return -1;
          if (b.symbol.toLowerCase() === queryLower) return 1;
          if (a.symbol.toLowerCase().startsWith(queryLower)) return -1;
          if (b.symbol.toLowerCase().startsWith(queryLower)) return 1;
          return a.symbol.localeCompare(b.symbol);
        })
        .slice(0, 12);
      const quotes: CryptoQuote[] = [];
      for (const crypto of matched) {
        const quote = await this.getCryptoQuote(crypto.symbol);
        if (quote) quotes.push(quote);
      }
      return quotes;
    } catch (error) {
      console.error('Error searching cryptos:', error);
      return [];
    }
  }
}

export const cryptoDataService = new CryptoDataService();
