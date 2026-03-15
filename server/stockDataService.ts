import axios from 'axios';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export interface StockQuote {
  symbol: string;
  companyName?: string;
  exchange: 'NSE' | 'BSE';
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  marketCap?: number;
  previousClose: number;
  timestamp: Date;
  astrologyBias?: number;
  horaInfluence?: string;
  adjustedPrice?: number;
}

export interface IndexData {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

export interface MarketOverview {
  indices: {
    nifty50: IndexData;
    sensex: IndexData;
    bankNifty: IndexData;
    niftyIT: IndexData;
  };
  topGainers: StockQuote[];
  topLosers: StockQuote[];
  mostActive: StockQuote[];
}

const NSE_COMPANY_NAMES: Record<string, string> = {
  'RELIANCE':    'Reliance Industries Ltd.',
  'TCS':         'Tata Consultancy Services Ltd.',
  'HDFCBANK':    'HDFC Bank Ltd.',
  'INFY':        'Infosys Ltd.',
  'ICICIBANK':   'ICICI Bank Ltd.',
  'KOTAKBANK':   'Kotak Mahindra Bank Ltd.',
  'HINDUNILVR':  'Hindustan Unilever Ltd.',
  'SBIN':        'State Bank of India',
  'BAJFINANCE':  'Bajaj Finance Ltd.',
  'BHARTIARTL':  'Bharti Airtel Ltd.',
  'ITC':         'ITC Ltd.',
  'AXISBANK':    'Axis Bank Ltd.',
  'LT':          'Larsen & Toubro Ltd.',
  'ASIANPAINT':  'Asian Paints Ltd.',
  'DMART':       'Avenue Supermarts Ltd.',
  'WIPRO':       'Wipro Ltd.',
  'MARUTI':      'Maruti Suzuki India Ltd.',
  'TITAN':       'Titan Company Ltd.',
  'NESTLEIND':   'Nestle India Ltd.',
  'SUNPHARMA':   'Sun Pharmaceutical Industries Ltd.',
  'ADANIGREEN':  'Adani Green Energy Ltd.',
  'ADANIENT':    'Adani Enterprises Ltd.',
  'ADANIPORTS':  'Adani Ports and SEZ Ltd.',
  'TATAMOTORS':  'Tata Motors Ltd.',
  'TATASTEEL':   'Tata Steel Ltd.',
  'JSWSTEEL':    'JSW Steel Ltd.',
  'POWERGRID':   'Power Grid Corporation of India Ltd.',
  'NTPC':        'NTPC Ltd.',
  'ONGC':        'Oil & Natural Gas Corporation Ltd.',
  'COALINDIA':   'Coal India Ltd.',
  'ULTRACEMCO':  'UltraTech Cement Ltd.',
  'GRASIM':      'Grasim Industries Ltd.',
  'DRREDDY':     "Dr. Reddy's Laboratories Ltd.",
  'CIPLA':       'Cipla Ltd.',
  'APOLLOHOSP':  'Apollo Hospitals Enterprise Ltd.',
  'HINDALCO':    'Hindalco Industries Ltd.',
  'TECHM':       'Tech Mahindra Ltd.',
  'HCLTECH':     'HCL Technologies Ltd.',
  'BPCL':        'Bharat Petroleum Corporation Ltd.',
  'IOC':         'Indian Oil Corporation Ltd.',
  'DIVISLAB':    "Divi's Laboratories Ltd.",
  'BRITANNIA':   'Britannia Industries Ltd.',
  'VEDL':        'Vedanta Ltd.',
  'EICHERMOT':   'Eicher Motors Ltd.',
  'UPL':         'UPL Ltd.',
  'SHREECEM':    'Shree Cement Ltd.',
  'INDUSINDBK':  'IndusInd Bank Ltd.',
  'HEROMOTOCO':  'Hero MotoCorp Ltd.',
  'BAJAJFINSV':  'Bajaj Finserv Ltd.',
  'SUZLON':      'Suzlon Energy Ltd.',
  'ZOMATO':      'Zomato Ltd.',
  'PAYTM':       'One97 Communications Ltd.',
  'NYKAA':       'FSN E-Commerce Ventures Ltd.',
  'IRCTC':       'Indian Railway Catering & Tourism Corporation',
  'PNB':         'Punjab National Bank',
  'BANKBARODA':  'Bank of Baroda',
  'CANBK':       'Canara Bank',
  'YESBANK':     'Yes Bank Ltd.',
  'IDBI':        'IDBI Bank Ltd.',
};

function calculateAstrologyBias(symbol: string): { bias: number; hora: string } {
  const hour = new Date().getHours();
  const horaRulers = [
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury'
  ];

  const currentHora = horaRulers[hour];
  const symbolHash = symbol.charCodeAt(0) + symbol.length;
  const horaIndex = horaRulers.indexOf(currentHora);

  let bias = ((symbolHash * horaIndex) % 11) - 5;

  switch (currentHora) {
    case 'Jupiter': bias += Math.random() > 0.5 ? 2 : 1; break;
    case 'Venus':   bias += Math.random() > 0.6 ? 1 : 0; break;
    case 'Saturn':  bias -= Math.random() > 0.5 ? 2 : 1; break;
    case 'Mars':    bias += Math.random() > 0.5 ? 1 : -1; break;
    case 'Mercury': bias += Math.random() > 0.7 ? 1 : 0; break;
    case 'Moon':    bias += (Math.random() - 0.5) * 2; break;
    case 'Sun':     bias += Math.random() > 0.6 ? 1 : 0; break;
  }

  bias = Math.max(-5, Math.min(5, Math.round(bias)));
  return { bias, hora: currentHora };
}

function applyAstrologyBias(quote: StockQuote): StockQuote {
  const { bias, hora } = calculateAstrologyBias(quote.symbol);
  const biasMultiplier = 1 + (bias * 0.002);
  const adjustedPrice = quote.lastPrice * biasMultiplier;

  return {
    ...quote,
    astrologyBias: bias,
    horaInfluence: hora,
    adjustedPrice: Math.round(adjustedPrice * 100) / 100,
  };
}

export class StockDataService {
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

  async getNSEQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `nse_quote_${symbol}`;
    if (this.isCacheValid(cacheKey)) return this.getCachedData(cacheKey);

    try {
      const response = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
        params: { symbol: `NSE:${symbol}`, token: FINNHUB_API_KEY },
        timeout: 10000,
      });

      const data = response.data;
      if (!data || data.c === 0) return null;

      const quote: StockQuote = {
        symbol,
        companyName: NSE_COMPANY_NAMES[symbol] || symbol,
        exchange: 'NSE',
        lastPrice: data.c,
        change: data.d ?? 0,
        changePercent: data.dp ?? 0,
        volume: 0,
        openPrice: data.o ?? data.c,
        highPrice: data.h ?? data.c,
        lowPrice: data.l ?? data.c,
        previousClose: data.pc ?? data.c,
        timestamp: new Date(),
      };

      const biasedQuote = applyAstrologyBias(quote);
      this.setCacheData(cacheKey, biasedQuote);
      return biasedQuote;
    } catch (error) {
      console.error(`Error fetching Finnhub NSE quote for ${symbol}:`, error);
      return null;
    }
  }

  async getBSEQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `bse_quote_${symbol}`;
    if (this.isCacheValid(cacheKey)) return this.getCachedData(cacheKey);

    try {
      const response = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
        params: { symbol: `BSE:${symbol}`, token: FINNHUB_API_KEY },
        timeout: 10000,
      });

      const data = response.data;
      if (!data || data.c === 0) {
        const nseQuote = await this.getNSEQuote(symbol);
        if (!nseQuote) return null;
        return { ...nseQuote, exchange: 'BSE' };
      }

      const quote: StockQuote = {
        symbol,
        companyName: NSE_COMPANY_NAMES[symbol] || symbol,
        exchange: 'BSE',
        lastPrice: data.c,
        change: data.d ?? 0,
        changePercent: data.dp ?? 0,
        volume: 0,
        openPrice: data.o ?? data.c,
        highPrice: data.h ?? data.c,
        lowPrice: data.l ?? data.c,
        previousClose: data.pc ?? data.c,
        timestamp: new Date(),
      };

      const biasedQuote = applyAstrologyBias(quote);
      this.setCacheData(cacheKey, biasedQuote);
      return biasedQuote;
    } catch (error) {
      console.error(`Error fetching Finnhub BSE quote for ${symbol}:`, error);
      return null;
    }
  }

  async getStockQuote(symbol: string, exchange?: 'NSE' | 'BSE'): Promise<StockQuote | null> {
    if (exchange === 'BSE') return this.getBSEQuote(symbol);
    if (exchange === 'NSE') return this.getNSEQuote(symbol);
    const nseQuote = await this.getNSEQuote(symbol);
    return nseQuote || this.getBSEQuote(symbol);
  }

  async getMarketIndices(): Promise<IndexData[]> {
    const cacheKey = 'market_indices';
    if (this.isCacheValid(cacheKey)) return this.getCachedData(cacheKey);

    try {
      const indexSymbols = [
        { finnhub: 'NSE:NIFTY50',   name: 'NIFTY 50'   },
        { finnhub: 'BSE:SENSEX',    name: 'SENSEX'      },
        { finnhub: 'NSE:BANKNIFTY', name: 'BANK NIFTY'  },
        { finnhub: 'NSE:NIFTYIT',   name: 'NIFTY IT'    },
      ];

      const results = await Promise.all(
        indexSymbols.map(async ({ finnhub, name }) => {
          try {
            const res = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
              params: { symbol: finnhub, token: FINNHUB_API_KEY },
              timeout: 10000,
            });
            const d = res.data;
            if (!d || d.c === 0) return null;
            return {
              name,
              value: d.c,
              change: d.d ?? 0,
              changePercent: d.dp ?? 0,
              timestamp: new Date(),
            } as IndexData;
          } catch {
            return null;
          }
        })
      );

      const indexData = results.filter(Boolean) as IndexData[];
      this.setCacheData(cacheKey, indexData);
      return indexData;
    } catch (error) {
      console.error('Error fetching market indices:', error);
      return [];
    }
  }

  async getMarketOverview(): Promise<MarketOverview> {
    const cacheKey = 'market_overview';
    if (this.isCacheValid(cacheKey)) return this.getCachedData(cacheKey);

    const
