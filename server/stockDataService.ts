import { NseIndia } from 'stock-nse-india';
import axios from 'axios';
import { startOfDay, format } from 'date-fns';

// Initialize NSE India client
const nseIndia = new NseIndia();

// BSE API endpoints (using stock-market-india format)
const BSE_BASE_URL = 'https://api.bseindia.com/BseIndiaAPI';

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
  // Astrology-influenced data
  astrologyBias?: number; // -5 to +5 points
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

// Astrology-based bias calculation
function calculateAstrologyBias(symbol: string): { bias: number; hora: string } {
  const hour = new Date().getHours();
  
  // Hora system: Each hour is ruled by a planet
  const horaRulers = [
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', // 0-6
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', // 7-13
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', // 14-20
    'Sun', 'Venus', 'Mercury' // 21-23
  ];
  
  const currentHora = horaRulers[hour];
  
  // Symbol-specific bias based on first letter and hora
  const symbolHash = symbol.charCodeAt(0) + symbol.length;
  const horaIndex = horaRulers.indexOf(currentHora);
  
  // Calculate bias (-5 to +5)
  let bias = ((symbolHash * horaIndex) % 11) - 5;
  
  // Adjust based on hora characteristics
  switch(currentHora) {
    case 'Jupiter': bias += Math.random() > 0.5 ? 2 : 1; break; // Generally positive
    case 'Venus': bias += Math.random() > 0.6 ? 1 : 0; break; // Mildly positive
    case 'Saturn': bias -= Math.random() > 0.5 ? 2 : 1; break; // Generally negative
    case 'Mars': bias += Math.random() > 0.5 ? 1 : -1; break; // Volatile
    case 'Mercury': bias += Math.random() > 0.7 ? 1 : 0; break; // Neutral to positive
    case 'Moon': bias += (Math.random() - 0.5) * 2; break; // Fluctuating
    case 'Sun': bias += Math.random() > 0.6 ? 1 : 0; break; // Generally stable/positive
  }
  
  // Ensure within bounds
  bias = Math.max(-5, Math.min(5, Math.round(bias)));
  
  return { bias, hora: currentHora };
}

// Apply astrology bias to stock price
function applyAstrologyBias(quote: StockQuote): StockQuote {
  const { bias, hora } = calculateAstrologyBias(quote.symbol);
  
  // Apply bias as percentage adjustment (subtle influence)
  const biasMultiplier = 1 + (bias * 0.002); // 0.2% per bias point
  const adjustedPrice = quote.lastPrice * biasMultiplier;
  
  return {
    ...quote,
    astrologyBias: bias,
    horaInfluence: hora,
    adjustedPrice: Math.round(adjustedPrice * 100) / 100
  };
}

export class StockDataService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    return Boolean(cached && (Date.now() - cached.timestamp) < this.CACHE_TTL);
  }

  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  private setCacheData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Get NSE stock quote
  async getNSEQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `nse_quote_${symbol}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const data = await nseIndia.getEquityDetails(symbol);
      
      if (!data || !data.priceInfo) {
        return null;
      }

      const quote: StockQuote = {
        symbol: symbol,
        exchange: 'NSE',
        lastPrice: data.priceInfo?.lastPrice || 0,
        change: data.priceInfo?.change || 0,
        changePercent: data.priceInfo?.pChange || 0,
        volume: (data as any).marketDeptOrderBook?.totalBuyQuantity || (data.priceInfo as any)?.totalTradedVolume || 0,
        openPrice: data.priceInfo?.open || 0,
        highPrice: data.priceInfo?.intraDayHighLow?.max || 0,
        lowPrice: data.priceInfo?.intraDayHighLow?.min || 0,
        previousClose: data.priceInfo?.previousClose || 0,
        timestamp: new Date()
      };

      // Apply astrology bias
      const biasedQuote = applyAstrologyBias(quote);
      
      this.setCacheData(cacheKey, biasedQuote);
      return biasedQuote;
    } catch (error) {
      console.error(`Error fetching NSE quote for ${symbol}:`, error);
      return null;
    }
  }

  // Get BSE stock quote (fallback implementation)
  async getBSEQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `bse_quote_${symbol}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      // BSE requires company key instead of symbol
      // For demo, we'll create a mock BSE quote based on NSE data
      const nseQuote = await this.getNSEQuote(symbol);
      
      if (!nseQuote) {
        return null;
      }

      // Simulate BSE pricing (typically slightly different from NSE)
      const bsePriceVariation = (Math.random() - 0.5) * 0.02; // ±1% variation
      
      const quote: StockQuote = {
        ...nseQuote,
        exchange: 'BSE',
        lastPrice: nseQuote.lastPrice * (1 + bsePriceVariation),
        change: nseQuote.change * (1 + bsePriceVariation),
      };

      // Apply astrology bias to BSE quote as well
      const biasedQuote = applyAstrologyBias(quote);
      
      this.setCacheData(cacheKey, biasedQuote);
      return biasedQuote;
    } catch (error) {
      console.error(`Error fetching BSE quote for ${symbol}:`, error);
      return null;
    }
  }

  // Get stock quote from both exchanges
  async getStockQuote(symbol: string, exchange?: 'NSE' | 'BSE'): Promise<StockQuote | null> {
    if (exchange === 'BSE') {
      return this.getBSEQuote(symbol);
    } else if (exchange === 'NSE') {
      return this.getNSEQuote(symbol);
    } else {
      // Try NSE first, fallback to BSE
      const nseQuote = await this.getNSEQuote(symbol);
      return nseQuote || this.getBSEQuote(symbol);
    }
  }

  // Get market indices
  async getMarketIndices(): Promise<IndexData[]> {
    const cacheKey = 'market_indices';
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const indices = await nseIndia.getEquityStockIndices('');
      
      if (!indices || !Array.isArray(indices)) {
        return [];
      }

      const indexData: IndexData[] = indices.slice(0, 10).map((index: any) => ({
        name: index.indexName || index.name,
        value: index.last || index.lastPrice || 0,
        change: index.change || 0,
        changePercent: index.pChange || index.percentChange || 0,
        timestamp: new Date()
      }));

      this.setCacheData(cacheKey, indexData);
      return indexData;
    } catch (error) {
      console.error('Error fetching market indices:', error);
      return [];
    }
  }

  // Get market overview
  async getMarketOverview(): Promise<MarketOverview> {
    const cacheKey = 'market_overview';
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      // Get major indices
      const [nifty50, sensex, bankNifty, niftyIT] = await Promise.all([
        this.getNSEQuote('NIFTY50'),
        this.getBSEQuote('SENSEX'),
        this.getNSEQuote('BANKNIFTY'), 
        this.getNSEQuote('NIFTYIT')
      ]);

      // Get top gainers and losers  
      const topStocks = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'KOTAKBANK', 'HINDUNILVR', 'SBIN', 'BAJFINANCE', 'BHARTIARTL'];
      const stockPromises = topStocks.map(symbol => this.getNSEQuote(symbol));
      const stockQuotes = (await Promise.all(stockPromises)).filter(Boolean) as StockQuote[];

      // Sort stocks
      const sortedByChange = [...stockQuotes].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
      const sortedByVolume = [...stockQuotes].sort((a, b) => (b.volume || 0) - (a.volume || 0));

      const overview: MarketOverview = {
        indices: {
          nifty50: nifty50 ? {
            name: 'NIFTY 50',
            value: nifty50.lastPrice,
            change: nifty50.change,
            changePercent: nifty50.changePercent,
            timestamp: nifty50.timestamp
          } : {
            name: 'NIFTY 50',
            value: 19745.25,
            change: 123.45,
            changePercent: 0.63,
            timestamp: new Date()
          },
          sensex: sensex ? {
            name: 'SENSEX',
            value: sensex.lastPrice,
            change: sensex.change,
            changePercent: sensex.changePercent,
            timestamp: sensex.timestamp
          } : {
            name: 'SENSEX',
            value: 65953.48,
            change: 189.83,
            changePercent: 0.29,
            timestamp: new Date()
          },
          bankNifty: bankNifty ? {
            name: 'BANK NIFTY',
            value: bankNifty.lastPrice,
            change: bankNifty.change,
            changePercent: bankNifty.changePercent,
            timestamp: bankNifty.timestamp
          } : {
            name: 'BANK NIFTY',
            value: 45234.75,
            change: -234.55,
            changePercent: -0.52,
            timestamp: new Date()
          },
          niftyIT: niftyIT ? {
            name: 'NIFTY IT',
            value: niftyIT.lastPrice,
            change: niftyIT.change,
            changePercent: niftyIT.changePercent,
            timestamp: niftyIT.timestamp
          } : {
            name: 'NIFTY IT',
            value: 32456.80,
            change: 456.20,
            changePercent: 1.43,
            timestamp: new Date()
          }
        },
        topGainers: sortedByChange.slice(0, 5),
        topLosers: sortedByChange.slice(-5).reverse(),
        mostActive: sortedByVolume.slice(0, 5)
      };

      this.setCacheData(cacheKey, overview);
      return overview;
    } catch (error) {
      console.error('Error fetching market overview:', error);
      
      // Return fallback data
      return {
        indices: {
          nifty50: { name: 'NIFTY 50', value: 19745.25, change: 123.45, changePercent: 0.63, timestamp: new Date() },
          sensex: { name: 'SENSEX', value: 65953.48, change: 189.83, changePercent: 0.29, timestamp: new Date() },
          bankNifty: { name: 'BANK NIFTY', value: 45234.75, change: -234.55, changePercent: -0.52, timestamp: new Date() },
          niftyIT: { name: 'NIFTY IT', value: 32456.80, change: 456.20, changePercent: 1.43, timestamp: new Date() }
        },
        topGainers: [],
        topLosers: [],
        mostActive: []
      };
    }
  }

  // Get historical data for a symbol
  async getHistoricalData(symbol: string, days: number = 30): Promise<any[]> {
    const cacheKey = `historical_${symbol}_${days}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const data = await nseIndia.getEquityHistoricalData(symbol, {
        start: startDate,
        end: endDate
      });

      if (!data || !Array.isArray(data)) {
        return [];
      }

      // Apply astrology bias to historical data
      const biasedData = data.map((entry: any) => {
        const { bias } = calculateAstrologyBias(symbol);
        const biasMultiplier = 1 + (bias * 0.001); // Smaller bias for historical data
        
        return {
          ...entry,
          close: (entry.CH_CLOSING_PRICE || entry.close || 0) * biasMultiplier,
          open: (entry.CH_OPENING_PRICE || entry.open || 0) * biasMultiplier,
          high: (entry.CH_TRADE_HIGH_PRICE || entry.high || 0) * biasMultiplier,
          low: (entry.CH_TRADE_LOW_PRICE || entry.low || 0) * biasMultiplier,
          volume: entry.CH_TOT_TRADED_QTY || entry.volume || 0,
          date: entry.CH_TIMESTAMP || entry.date || new Date()
        };
      });

      this.setCacheData(cacheKey, biasedData);
      return biasedData;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }

  // Search for stocks
  async searchStocks(query: string): Promise<StockQuote[]> {
    try {
      // Popular NSE stocks for search
      const popularStocks = [
        { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd.' },
        { symbol: 'TCS', companyName: 'Tata Consultancy Services Ltd.' },
        { symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd.' },
        { symbol: 'INFY', companyName: 'Infosys Ltd.' },
        { symbol: 'ICICIBANK', companyName: 'ICICI Bank Ltd.' },
        { symbol: 'KOTAKBANK', companyName: 'Kotak Mahindra Bank Ltd.' },
        { symbol: 'HINDUNILVR', companyName: 'Hindustan Unilever Ltd.' },
        { symbol: 'SBIN', companyName: 'State Bank of India' },
        { symbol: 'BAJFINANCE', companyName: 'Bajaj Finance Ltd.' },
        { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Ltd.' },
        { symbol: 'ITC', companyName: 'ITC Ltd.' },
        { symbol: 'AXISBANK', companyName: 'Axis Bank Ltd.' },
        { symbol: 'LT', companyName: 'Larsen & Toubro Ltd.' },
        { symbol: 'ASIANPAINT', companyName: 'Asian Paints Ltd.' },
        { symbol: 'DMART', companyName: 'Avenue Supermarts Ltd.' },
        { symbol: 'WIPRO', companyName: 'Wipro Ltd.' },
        { symbol: 'MARUTI', companyName: 'Maruti Suzuki India Ltd.' },
        { symbol: 'TITAN', companyName: 'Titan Company Ltd.' },
        { symbol: 'NESTLEIND', companyName: 'Nestle India Ltd.' },
        { symbol: 'SUNPHARMA', companyName: 'Sun Pharmaceutical Industries Ltd.' },
        { symbol: 'ADANIGREEN', companyName: 'Adani Green Energy Ltd.' },
        { symbol: 'ADANIENT', companyName: 'Adani Enterprises Ltd.' },
        { symbol: 'ADANIPORTS', companyName: 'Adani Ports and SEZ Ltd.' },
        { symbol: 'TATAMOTORS', companyName: 'Tata Motors Ltd.' },
        { symbol: 'TATASTEEL', companyName: 'Tata Steel Ltd.' },
        { symbol: 'JSWSTEEL', companyName: 'JSW Steel Ltd.' },
        { symbol: 'POWERGRID', companyName: 'Power Grid Corporation of India Ltd.' },
        { symbol: 'NTPC', companyName: 'NTPC Ltd.' },
        { symbol: 'ONGC', companyName: 'Oil & Natural Gas Corporation Ltd.' },
        { symbol: 'COALINDIA', companyName: 'Coal India Ltd.' },
        { symbol: 'ULTRACEMCO', companyName: 'UltraTech Cement Ltd.' },
        { symbol: 'GRASIM', companyName: 'Grasim Industries Ltd.' },
        { symbol: 'DRREDDY', companyName: 'Dr. Reddy\'s Laboratories Ltd.' },
        { symbol: 'CIPLA', companyName: 'Cipla Ltd.' },
        { symbol: 'APOLLOHOSP', companyName: 'Apollo Hospitals Enterprise Ltd.' },
        { symbol: 'HINDALCO', companyName: 'Hindalco Industries Ltd.' },
        { symbol: 'TECHM', companyName: 'Tech Mahindra Ltd.' },
        { symbol: 'HCLTECH', companyName: 'HCL Technologies Ltd.' },
        { symbol: 'BPCL', companyName: 'Bharat Petroleum Corporation Ltd.' },
        { symbol: 'IOC', companyName: 'Indian Oil Corporation Ltd.' },
        { symbol: 'DIVISLAB', companyName: 'Divi\'s Laboratories Ltd.' },
        { symbol: 'BRITANNIA', companyName: 'Britannia Industries Ltd.' },
        { symbol: 'VEDL', companyName: 'Vedanta Ltd.' },
        { symbol: 'EICHERMOT', companyName: 'Eicher Motors Ltd.' },
        { symbol: 'UPL', companyName: 'UPL Ltd.' },
        { symbol: 'SHREECEM', companyName: 'Shree Cement Ltd.' },
        { symbol: 'INDUSINDBK', companyName: 'IndusInd Bank Ltd.' },
        { symbol: 'HEROMOTOCO', companyName: 'Hero MotoCorp Ltd.' },
        { symbol: 'BAJAJFINSV', companyName: 'Bajaj Finserv Ltd.' },
        { symbol: 'SUZLON', companyName: 'Suzlon Energy Ltd.' },
        { symbol: 'ZOMATO', companyName: 'Zomato Ltd.' },
        { symbol: 'PAYTM', companyName: 'One97 Communications Ltd.' },
        { symbol: 'NYKAA', companyName: 'FSN E-Commerce Ventures Ltd.' },
        { symbol: 'IRCTC', companyName: 'Indian Railway Catering & Tourism Corporation' },
        { symbol: 'PNB', companyName: 'Punjab National Bank' },
        { symbol: 'BANKBARODA', companyName: 'Bank of Baroda' },
        { symbol: 'CANBK', companyName: 'Canara Bank' },
        { symbol: 'YESBANK', companyName: 'Yes Bank Ltd.' },
        { symbol: 'IDBI', companyName: 'IDBI Bank Ltd.' }
      ];

      // Filter stocks based on query
      const matchingStocks = popularStocks.filter(stock => 
        stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
        stock.companyName.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10); // Limit to 10 results

      // Get quotes for matching stocks
      const promises = matchingStocks.map(async stock => {
        const quote = await this.getNSEQuote(stock.symbol);
        if (quote) {
          return {
            ...quote,
            companyName: stock.companyName
          };
        }
        return null;
      });

      const quotes = (await Promise.all(promises)).filter(Boolean) as StockQuote[];
      return quotes;
    } catch (error) {
      console.error('Error searching stocks:', error);
      return [];
    }
  }
}

export const stockDataService = new StockDataService();