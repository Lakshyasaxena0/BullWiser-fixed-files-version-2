
import axios from 'axios';
import { startOfDay, format } from 'date-fns';

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
  // Astrology-influenced data
  astrologyBias?: number; // -5 to +5 points
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

// Astrology-based bias calculation for crypto
function calculateCryptoAstrologyBias(symbol: string): { bias: number; hora: string } {
  const hour = new Date().getHours();
  
  // Hora system: Each hour is ruled by a planet
  const horaRulers = [
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury'
  ];
  
  const currentHora = horaRulers[hour];
  
  // Symbol-specific bias based on crypto characteristics
  const cryptoInfluence = {
    'BTC': { base: 2, volatility: 1.2 }, // Bitcoin - Sun ruled, stable
    'ETH': { base: 1, volatility: 1.1 }, // Ethereum - Mercury ruled, innovation
    'BNB': { base: 0, volatility: 0.9 }, // Binance - Venus ruled, growth
    'ADA': { base: 1, volatility: 0.8 }, // Cardano - Jupiter ruled, wisdom
    'SOL': { base: 2, volatility: 1.3 }, // Solana - Mars ruled, aggressive
    'XRP': { base: -1, volatility: 1.1 }, // Ripple - Saturn ruled, regulation
    'DOT': { base: 1, volatility: 1.0 }, // Polkadot - Mercury ruled, connectivity
    'MATIC': { base: 1, volatility: 0.9 }, // Polygon - Moon ruled, adaptive
    'AVAX': { base: 1, volatility: 1.2 }, // Avalanche - Mars ruled, fast
    'ATOM': { base: 0, volatility: 1.0 }  // Cosmos - Jupiter ruled, universal
  };
  
  const cryptoData = cryptoInfluence[symbol as keyof typeof cryptoInfluence] || { base: 0, volatility: 1.0 };
  const symbolHash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const horaIndex = horaRulers.indexOf(currentHora);
  
  // Calculate bias (-5 to +5)
  let bias = ((symbolHash * horaIndex) % 11) - 5 + cryptoData.base;
  
  // Adjust based on hora characteristics and crypto volatility
  switch(currentHora) {
    case 'Jupiter': bias += Math.random() > 0.5 ? 2 : 1; break; // Generally positive
    case 'Venus': bias += Math.random() > 0.6 ? 1 : 0; break; // Mildly positive
    case 'Saturn': bias -= Math.random() > 0.5 ? 2 : 1; break; // Generally negative
    case 'Mars': bias += Math.random() > 0.5 ? 2 : -2; break; // High volatility
    case 'Mercury': bias += Math.random() > 0.7 ? 1 : 0; break; // Tech-positive
    case 'Moon': bias += (Math.random() - 0.5) * 3; break; // High fluctuation
    case 'Sun': bias += Math.random() > 0.6 ? 1 : 0; break; // Generally stable/positive
  }
  
  // Apply crypto-specific volatility
  bias *= cryptoData.volatility;
  
  // Ensure within bounds
  bias = Math.max(-5, Math.min(5, Math.round(bias)));
  
  return { bias, hora: currentHora };
}

// Apply astrology bias to crypto price
function applyCryptoAstrologyBias(quote: CryptoQuote): CryptoQuote {
  const { bias, hora } = calculateCryptoAstrologyBias(quote.symbol);
  
  // Apply bias as percentage adjustment (crypto has higher volatility than stocks)
  const biasMultiplier = 1 + (bias * 0.005); // 0.5% per bias point
  const adjustedPrice = quote.lastPrice * biasMultiplier;
  
  return {
    ...quote,
    astrologyBias: bias,
    horaInfluence: hora,
    adjustedPrice: Math.round(adjustedPrice * 100) / 100
  };
}

export class CryptoDataService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute cache
  private readonly COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

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

  // Get crypto quote
  async getCryptoQuote(symbol: string): Promise<CryptoQuote | null> {
    const cacheKey = `crypto_quote_${symbol}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      // Convert symbol to CoinGecko ID format
      const cryptoIds = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'BNB': 'binancecoin',
        'ADA': 'cardano',
        'SOL': 'solana',
        'XRP': 'ripple',
        'DOT': 'polkadot',
        'MATIC': 'matic-network',
        'AVAX': 'avalanche-2',
        'ATOM': 'cosmos',
        'LINK': 'chainlink',
        'UNI': 'uniswap',
        'LTC': 'litecoin',
        'BCH': 'bitcoin-cash',
        'ALGO': 'algorand',
        'VET': 'vechain',
        'FIL': 'filecoin',
        'DOGE': 'dogecoin',
        'SHIB': 'shiba-inu',
        'TRX': 'tron'
      };

      const coinId = cryptoIds[symbol as keyof typeof cryptoIds];
      if (!coinId) {
        return null;
      }

      const response = await axios.get(
        `${this.COINGECKO_BASE_URL}/coins/${coinId}`,
        {
          params: {
            localization: false,
            tickers: false,
            market_data: true,
            community_data: false,
            developer_data: false,
            sparkline: false
          },
          timeout: 10000
        }
      );

      const data = response.data;
      if (!data || !data.market_data) {
        return null;
      }

      const marketData = data.market_data;
      
      const quote: CryptoQuote = {
        symbol: symbol.toUpperCase(),
        name: data.name,
        lastPrice: marketData.current_price?.usd || 0,
        change24h: marketData.price_change_24h || 0,
        changePercent24h: marketData.price_change_percentage_24h || 0,
        volume24h: marketData.total_volume?.usd || 0,
        marketCap: marketData.market_cap?.usd || 0,
        high24h: marketData.high_24h?.usd || 0,
        low24h: marketData.low_24h?.usd || 0,
        timestamp: new Date()
      };

      // Apply astrology bias
      const biasedQuote = applyCryptoAstrologyBias(quote);
      
      this.setCacheData(cacheKey, biasedQuote);
      return biasedQuote;
    } catch (error) {
      console.error(`Error fetching crypto quote for ${symbol}:`, error);
      return null;
    }
  }

  // Get crypto market overview
  async getCryptoOverview(): Promise<CryptoOverview> {
    const cacheKey = 'crypto_overview';
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      // Get global market data
      const globalResponse = await axios.get(`${this.COINGECKO_BASE_URL}/global`, { timeout: 10000 });
      const globalData = globalResponse.data?.data;

      // Get top cryptocurrencies
      const cryptosResponse = await axios.get(
        `${this.COINGECKO_BASE_URL}/coins/markets`,
        {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 20,
            page: 1,
            sparkline: false
          },
          timeout: 10000
        }
      );

      const cryptos = cryptosResponse.data;
      if (!cryptos || !Array.isArray(cryptos)) {
        throw new Error('Invalid response format');
      }

      // Convert to our format and apply astrology bias
      const cryptoQuotes: CryptoQuote[] = cryptos.map((crypto: any) => {
        const quote: CryptoQuote = {
          symbol: crypto.symbol.toUpperCase(),
          name: crypto.name,
          lastPrice: crypto.current_price || 0,
          change24h: crypto.price_change_24h || 0,
          changePercent24h: crypto.price_change_percentage_24h || 0,
          volume24h: crypto.total_volume || 0,
          marketCap: crypto.market_cap || 0,
          high24h: crypto.high_24h || 0,
          low24h: crypto.low_24h || 0,
          timestamp: new Date()
        };
        return applyCryptoAstrologyBias(quote);
      });

      // Sort by performance
      const sortedByChange = [...cryptoQuotes].sort((a, b) => (b.changePercent24h || 0) - (a.changePercent24h || 0));
      const sortedByVolume = [...cryptoQuotes].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

      const overview: CryptoOverview = {
        totalMarketCap: globalData?.total_market_cap?.usd || 0,
        totalVolume: globalData?.total_volume?.usd || 0,
        marketCapChange24h: globalData?.market_cap_change_percentage_24h_usd || 0,
        topGainers: sortedByChange.slice(0, 5),
        topLosers: sortedByChange.slice(-5).reverse(),
        mostActive: sortedByVolume.slice(0, 5)
      };

      this.setCacheData(cacheKey, overview);
      return overview;
    } catch (error) {
      console.error('Error fetching crypto overview:', error);
      
      // Return fallback data
      return {
        totalMarketCap: 1200000000000, // $1.2T fallback
        totalVolume: 50000000000, // $50B fallback
        marketCapChange24h: 0.5,
        topGainers: [],
        topLosers: [],
        mostActive: []
      };
    }
  }

  // Get historical crypto data
  async getCryptoHistoricalData(symbol: string, days: number = 30): Promise<any[]> {
    const cacheKey = `crypto_historical_${symbol}_${days}`;
    
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const cryptoIds = {
        'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin', 'ADA': 'cardano',
        'SOL': 'solana', 'XRP': 'ripple', 'DOT': 'polkadot', 'MATIC': 'matic-network',
        'AVAX': 'avalanche-2', 'ATOM': 'cosmos', 'LINK': 'chainlink', 'UNI': 'uniswap',
        'LTC': 'litecoin', 'BCH': 'bitcoin-cash', 'ALGO': 'algorand', 'VET': 'vechain',
        'FIL': 'filecoin', 'DOGE': 'dogecoin', 'SHIB': 'shiba-inu', 'TRX': 'tron'
      };

      const coinId = cryptoIds[symbol as keyof typeof cryptoIds];
      if (!coinId) {
        return [];
      }

      const response = await axios.get(
        `${this.COINGECKO_BASE_URL}/coins/${coinId}/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days: days,
            interval: 'daily'
          },
          timeout: 15000
        }
      );

      const data = response.data;
      if (!data || !data.prices) {
        return [];
      }

      // Apply astrology bias to historical data
      const { bias } = calculateCryptoAstrologyBias(symbol);
      const biasMultiplier = 1 + (bias * 0.002); // Smaller bias for historical data

      const historicalData = data.prices.map((price: [number, number], index: number) => ({
        date: new Date(price[0]),
        close: price[1] * biasMultiplier,
        volume: data.total_volumes?.[index]?.[1] || 0,
        marketCap: data.market_caps?.[index]?.[1] || 0
      }));

      this.setCacheData(cacheKey, historicalData);
      return historicalData;
    } catch (error) {
      console.error(`Error fetching crypto historical data for ${symbol}:`, error);
      return [];
    }
  }

  // Search cryptocurrencies
  async searchCryptos(query: string): Promise<CryptoQuote[]> {
    try {
      const allCryptos = [
        // Top Market Cap
        { symbol: 'BTC', name: 'Bitcoin' },
        { symbol: 'ETH', name: 'Ethereum' },
        { symbol: 'BNB', name: 'BNB' },
        { symbol: 'XRP', name: 'XRP' },
        { symbol: 'ADA', name: 'Cardano' },
        { symbol: 'SOL', name: 'Solana' },
        { symbol: 'DOGE', name: 'Dogecoin' },
        { symbol: 'TRX', name: 'TRON' },
        { symbol: 'DOT', name: 'Polkadot' },
        { symbol: 'MATIC', name: 'Polygon' },
        
        // DeFi & Layer 1
        { symbol: 'AVAX', name: 'Avalanche' },
        { symbol: 'ATOM', name: 'Cosmos' },
        { symbol: 'LINK', name: 'Chainlink' },
        { symbol: 'UNI', name: 'Uniswap' },
        { symbol: 'ALGO', name: 'Algorand' },
        { symbol: 'VET', name: 'VeChain' },
        { symbol: 'FIL', name: 'Filecoin' },
        
        // Traditional Cryptos
        { symbol: 'LTC', name: 'Litecoin' },
        { symbol: 'BCH', name: 'Bitcoin Cash' },
        
        // Meme Coins
        { symbol: 'SHIB', name: 'Shiba Inu' },
        
        // Additional Popular Cryptos
        { symbol: 'NEAR', name: 'NEAR Protocol' },
        { symbol: 'HBAR', name: 'Hedera' },
        { symbol: 'ICP', name: 'Internet Computer' },
        { symbol: 'APT', name: 'Aptos' },
        { symbol: 'ARB', name: 'Arbitrum' },
        { symbol: 'OP', name: 'Optimism' },
        { symbol: 'INJ', name: 'Injective' },
        { symbol: 'SUI', name: 'Sui' },
        { symbol: 'SEI', name: 'Sei' },
        { symbol: 'TIA', name: 'Celestia' }
      ];

      // Enhanced filtering - search in both symbol and name with partial matching
      const matchingCryptos = allCryptos.filter(crypto => {
        const queryLower = query.toLowerCase().trim();
        const symbolLower = crypto.symbol.toLowerCase();
        const nameLower = crypto.name.toLowerCase();
        
        // Direct symbol or name matches
        if (symbolLower.includes(queryLower) || nameLower.includes(queryLower)) {
          return true;
        }
        
        // Starts with matches
        if (symbolLower.startsWith(queryLower) || nameLower.startsWith(queryLower)) {
          return true;
        }
        
        // Allow partial word matching
        if (nameLower.split(' ').some(word => word.startsWith(queryLower))) {
          return true;
        }
        
        // Handle common search patterns and aliases
        const commonMappings: { [key: string]: string[] } = {
          'bitcoin': ['btc'],
          'btc': ['bitcoin'],
          'ethereum': ['eth'],
          'eth': ['ethereum'], 
          'ripple': ['xrp'],
          'xrp': ['ripple'],
          'binance coin': ['bnb'],
          'bnb': ['binance coin', 'binance'],
          'cardano': ['ada'],
          'ada': ['cardano'],
          'solana': ['sol'],
          'sol': ['solana'],
          'dogecoin': ['doge'],
          'doge': ['dogecoin'],
          'polkadot': ['dot'],
          'dot': ['polkadot'],
          'polygon': ['matic'],
          'matic': ['polygon'],
          'avalanche': ['avax'],
          'avax': ['avalanche'],
          'cosmos': ['atom'],
          'atom': ['cosmos'],
          'chainlink': ['link'],
          'link': ['chainlink'],
          'uniswap': ['uni'],
          'uni': ['uniswap'],
          'litecoin': ['ltc'],
          'ltc': ['litecoin'],
          'bitcoin cash': ['bch'],
          'bch': ['bitcoin cash'],
          'algorand': ['algo'],
          'algo': ['algorand'],
          'vechain': ['vet'],
          'vet': ['vechain'],
          'filecoin': ['fil'],
          'fil': ['filecoin'],
          'shiba inu': ['shib'],
          'shib': ['shiba inu'],
          'tron': ['trx'],
          'trx': ['tron']
        };
        
        // Check if query matches any known alias
        const aliases = commonMappings[queryLower] || [];
        if (aliases.some(alias => symbolLower === alias || nameLower.includes(alias))) {
          return true;
        }
        
        // Check if symbol or name matches any alias of the query
        if (commonMappings[symbolLower]?.includes(queryLower) || 
            commonMappings[nameLower]?.includes(queryLower)) {
          return true;
        }
        
        return false;
      });

      // Sort results: exact symbol matches first, then symbol starts with, then name matches
      const sortedCryptos = matchingCryptos.sort((a, b) => {
        const queryLower = query.toLowerCase();
        
        // Exact symbol match gets highest priority
        if (a.symbol.toLowerCase() === queryLower) return -1;
        if (b.symbol.toLowerCase() === queryLower) return 1;
        
        // Symbol starts with query gets second priority
        if (a.symbol.toLowerCase().startsWith(queryLower) && !b.symbol.toLowerCase().startsWith(queryLower)) return -1;
        if (b.symbol.toLowerCase().startsWith(queryLower) && !a.symbol.toLowerCase().startsWith(queryLower)) return 1;
        
        // Name starts with query gets third priority
        if (a.name.toLowerCase().startsWith(queryLower) && !b.name.toLowerCase().startsWith(queryLower)) return -1;
        if (b.name.toLowerCase().startsWith(queryLower) && !a.name.toLowerCase().startsWith(queryLower)) return 1;
        
        // Alphabetical order for the rest
        return a.symbol.localeCompare(b.symbol);
      }).slice(0, 12); // Show up to 12 results

      // Get quotes for matching cryptos with better error handling
      const quotes: CryptoQuote[] = [];
      
      for (const crypto of sortedCryptos) {
        try {
          const quote = await this.getCryptoQuote(crypto.symbol);
          if (quote) {
            quotes.push(quote);
          } else {
            // Fallback with basic data if API fails
            const fallbackQuote: CryptoQuote = {
              symbol: crypto.symbol,
              name: crypto.name,
              lastPrice: crypto.symbol === 'BTC' ? 43250.00 : crypto.symbol === 'ETH' ? 2650.00 : 1.00,
              change24h: 0,
              changePercent24h: 0,
              volume24h: 1000000000,
              marketCap: crypto.symbol === 'BTC' ? 850000000000 : crypto.symbol === 'ETH' ? 320000000000 : 1000000000,
              high24h: crypto.symbol === 'BTC' ? 43500.00 : crypto.symbol === 'ETH' ? 2680.00 : 1.05,
              low24h: crypto.symbol === 'BTC' ? 42800.00 : crypto.symbol === 'ETH' ? 2620.00 : 0.95,
              timestamp: new Date()
            };
            quotes.push(applyCryptoAstrologyBias(fallbackQuote));
          }
        } catch (error) {
          console.warn(`Failed to get quote for ${crypto.symbol}:`, error);
          // Add fallback data even on error
          const fallbackQuote: CryptoQuote = {
            symbol: crypto.symbol,
            name: crypto.name,
            lastPrice: crypto.symbol === 'BTC' ? 43250.00 : crypto.symbol === 'ETH' ? 2650.00 : 1.00,
            change24h: 0,
            changePercent24h: 0,
            volume24h: 1000000000,
            marketCap: crypto.symbol === 'BTC' ? 850000000000 : crypto.symbol === 'ETH' ? 320000000000 : 1000000000,
            high24h: crypto.symbol === 'BTC' ? 43500.00 : crypto.symbol === 'ETH' ? 2680.00 : 1.05,
            low24h: crypto.symbol === 'BTC' ? 42800.00 : crypto.symbol === 'ETH' ? 2620.00 : 0.95,
            timestamp: new Date()
          };
          quotes.push(applyCryptoAstrologyBias(fallbackQuote));
        }
      }
      
      return quotes;
    } catch (error) {
      console.error('Error searching cryptos:', error);
      return [];
    }
  }
}

export const cryptoDataService = new CryptoDataService();
