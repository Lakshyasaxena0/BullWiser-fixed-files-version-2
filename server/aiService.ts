import { GoogleGenerativeAI } from "@google/generative-ai";
import { stockDataService } from './stockDataService';
import { feedbackLearningService } from './feedbackLearningService';
import { astrologyService } from './astrologyService';
import { advancedAstrologyService } from './advancedAstrologyService';

// Gemini client — env var is still named OPENAI_API_KEY on Render
const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY || '');
const geminiFlash = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
async function geminiJSON(systemPrompt: string, userPrompt: string): Promise<any> {
  const full = `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences.\n\n${userPrompt}`;
  const result = await geminiFlash.generateContent(full);
  const text = result.response.text().trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  return JSON.parse(text);
}

// ── Stock → Sector mapping ────────────────────────────────────────────────────
const STOCK_SECTOR_MAP: Record<string, string> = {
  TCS: 'IT', INFY: 'IT', WIPRO: 'IT', HCLTECH: 'IT', TECHM: 'IT',
  HDFCBANK: 'Banking', ICICIBANK: 'Banking', SBIN: 'Banking', AXISBANK: 'Banking',
  KOTAKBANK: 'Banking', PNB: 'Banking', BANKBARODA: 'Banking', INDUSINDBK: 'Banking',
  YESBANK: 'Banking', CANBK: 'Banking', IDBI: 'Banking',
  SUNPHARMA: 'Pharma', DRREDDY: 'Pharma', CIPLA: 'Pharma', DIVISLAB: 'Pharma', APOLLOHOSP: 'Pharma',
  ONGC: 'Energy', BPCL: 'Energy', IOC: 'Energy', POWERGRID: 'Energy', NTPC: 'Energy', ADANIGREEN: 'Energy', RELIANCE: 'Energy',
  MARUTI: 'Auto', TATAMOTORS: 'Auto', HEROMOTOCO: 'Auto', EICHERMOT: 'Auto', BAJAJFINSV: 'Auto',
  HINDUNILVR: 'FMCG', ITC: 'FMCG', NESTLEIND: 'FMCG', BRITANNIA: 'FMCG', TITAN: 'FMCG', ASIANPAINT: 'FMCG', DMART: 'FMCG', ZOMATO: 'FMCG', IRCTC: 'FMCG', NYKAA: 'FMCG',
  TATASTEEL: 'Metals', JSWSTEEL: 'Metals', HINDALCO: 'Metals', VEDL: 'Metals', COALINDIA: 'Metals', ULTRACEMCO: 'Metals', GRASIM: 'Metals', SHREECEM: 'Metals', LT: 'Metals',
  ADANIENT: 'Realty', ADANIPORTS: 'Realty',
  BHARTIARTL: 'IT', PAYTM: 'IT',
  BAJFINANCE: 'Banking',
};

function getSectorForSymbol(symbol: string): string {
  return STOCK_SECTOR_MAP[symbol.toUpperCase()] || 'General';
}

interface AIAnalysisResult {
  prediction: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    priceTarget: { low: number; high: number };
    timeframe: string;
  };
  analysis: {
    technicalFactors: string[];
    marketSentiment: string;
    keyRisks: string[];
    recommendation: string;
  };
  reasoning: string;
}

export class AIService {
  private isConfigured(): boolean { return !!process.env.OPENAI_API_KEY; }

  async analyzeStock(symbol: string, currentPrice: number, historicalData?: any[]): Promise<AIAnalysisResult | null> {
    if (!this.isConfigured()) return null;
    try {
      const stockQuote     = await stockDataService.getStockQuote(symbol);
      const marketOverview = await stockDataService.getMarketOverview();
      const context = {
        symbol,
        currentPrice:    stockQuote?.lastPrice || currentPrice,
        dayChange:       stockQuote?.changePercent || 0,
        volume:          stockQuote?.volume || 0,
        marketIndices:   marketOverview?.indices || {},
        historicalTrend: historicalData?.slice(-10) || [],
      };
      const prompt = `As a financial analyst AI, analyze the following stock data and provide a prediction:
        Stock Symbol: ${context.symbol}
        Current Price: ₹${context.currentPrice}
        Day Change: ${context.dayChange}%
        Volume: ${context.volume}
        Market Context:
        - NIFTY 50: ${context.marketIndices.nifty50?.value || 'N/A'} (${context.marketIndices.nifty50?.changePercent || 0}%)
        - SENSEX: ${context.marketIndices.sensex?.value || 'N/A'} (${context.marketIndices.sensex?.changePercent || 0}%)
        Recent Price History: ${JSON.stringify(context.historicalTrend.slice(-5))}
        Provide JSON: { "prediction": { "direction": "bullish|bearish|neutral", "confidence": 0-100, "priceTarget": { "low": number, "high": number }, "timeframe": "1-3 days" }, "analysis": { "technicalFactors": [...], "marketSentiment": "...", "keyRisks": [...], "recommendation": "..." }, "reasoning": "..." }`;

      const r = await geminiJSON(
        'You are a professional stock market analyst specializing in Indian equities (NSE/BSE).',
        prompt
      );

      return {
        prediction: {
          direction:   r.prediction?.direction   || 'neutral',
          confidence:  r.prediction?.confidence  || 60,
          priceTarget: {
            low:  r.prediction?.priceTarget?.low  || currentPrice * 0.98,
            high: r.prediction?.priceTarget?.high || currentPrice * 1.02,
          },
          timeframe: r.prediction?.timeframe || '1-3 days',
        },
        analysis: {
          technicalFactors: r.analysis?.technicalFactors || [],
          marketSentiment:  r.analysis?.marketSentiment  || 'mixed',
          keyRisks:         r.analysis?.keyRisks         || [],
          recommendation:   r.analysis?.recommendation   || 'Hold and observe',
        },
        reasoning: r.reasoning || 'Gemini AI technical analysis',
      };
    } catch (error) {
      console.error('Error in Gemini stock analysis:', error);
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MAIN PREDICTION ENGINE
  // Pipeline: Gemini AI + Basic Astro + Advanced Astro (D-10, Sector, Transits, Yogas)
  // ────────────────────────────────────────────────────────────────────────────
  async generateEnhancedPrediction(
    symbol: string,
    currentPrice: number,
    userId?: string,
    historicalData?: any[]
  ): Promise<any> {
    try {
      // Step 1: Feedback learning adjustments
      const learningAdjustment = userId
        ? await feedbackLearningService.getLearningAdjustments(symbol, userId)
        : await feedbackLearningService.getLearningAdjustments(symbol);

      // Step 2: Gemini AI analysis
      let aiPrediction: AIAnalysisResult | null = null;
      if (this.isConfigured()) {
        aiPrediction = await this.analyzeStock(symbol, currentPrice, historicalData);
      }

      // Step 3: Basic Vedic astrology (Hora, Tithi, Nakshatra, Muhurat, Rahu Kalam)
      const astroPrediction = await astrologyService.generateAstroPrediction(symbol, new Date(), currentPrice);

      // Step 4: Advanced astrology ────────────────────────────────────────────
      const sector = getSectorForSymbol(symbol);
      let advancedAstroResult: any = null;
      let yogaBonus    = 0;
      let transitImpact = 0;
      let d10Analysis: any = null;

      try {
        // 4a. Sector planetary analysis
        advancedAstroResult = await advancedAstrologyService.analyzeStockBySector(symbol, sector, new Date());
        console.log(`[AdvAstro] ${symbol} (${sector}): timing=${advancedAstroResult?.timing}, sectorStrength=${advancedAstroResult?.sectorStrength}`);

        // 4b. D-10 Dashamsa chart
        const d1Chart = advancedAstrologyService.generateD1Chart(new Date(), '09:15', 19.0760, 72.8777);
        d10Analysis   = advancedAstrologyService.generateD10Chart(d1Chart);

        // 4c. Yoga analysis from D-10 career chart
        const careerYogas = d10Analysis?.yogas || [];
        yogaBonus = careerYogas.reduce((sum: number, yoga: any) => {
          if (yoga.type === 'rajyoga')  return sum + Math.min(yoga.strength * 0.15, 15);
          if (yoga.type === 'dhanyoga') return sum + Math.min(yoga.strength * 0.10, 10);
          if (yoga.type === 'arishta')  return sum - Math.min(yoga.strength * 0.10, 10);
          return sum;
        }, 0);
        yogaBonus = Math.max(-20, Math.min(20, Math.round(yogaBonus)));

        // 4d. Planetary transits
        const transits     = advancedAstrologyService.calculateTransits(d1Chart, new Date());
        const beneficCount = transits.filter((t: any) => t.effect === 'beneficial').length;
        const maleficCount = transits.filter((t: any) => t.effect === 'malefic').length;
        transitImpact      = Math.max(-15, Math.min(15, (beneficCount - maleficCount) * 3));

        console.log(`[AdvAstro] D-10 yogas=${careerYogas.length}, yogaBonus=${yogaBonus}, transitImpact=${transitImpact}`);
      } catch (advErr) {
        console.error('[AdvAstro] Advanced astrology error (non-fatal):', advErr);
      }

      // Step 5: Combine AI + basic astro — pass currentPrice so targets are computed
      let combinedPrediction = astrologyService.combineAIAndAstroPredictions(
        aiPrediction, astroPrediction, learningAdjustment.confidenceAdjustment, currentPrice
      );

      // Step 6: Apply advanced astrology adjustments
      if (advancedAstroResult) {
        const sectorStrength  = advancedAstroResult.sectorStrength || 50;
        const sectorBias      = (sectorStrength - 50) / 50;
        const sectorConfBoost = Math.round(sectorBias * 12);

        if (combinedPrediction.combinedConfidence !== undefined) {
          combinedPrediction.combinedConfidence = Math.min(95, Math.max(30,
            combinedPrediction.combinedConfidence + sectorConfBoost + yogaBonus + transitImpact
          ));
        }

        const timing = advancedAstroResult.timing;
        if (timing === 'excellent' && combinedPrediction.finalDirection === 'bearish') {
          combinedPrediction.finalDirection = 'neutral';
        }
        if (timing === 'challenging' && combinedPrediction.finalDirection === 'bullish') {
          combinedPrediction.finalDirection = 'neutral';
        }

        const sectorFactors = (advancedAstroResult.keyFactors || []).slice(0, 3)
          .map((f: string) => `[${sector} sector] ${f}`);

        if (!combinedPrediction.analysis) {
          combinedPrediction.analysis = { technicalFactors: [], marketSentiment: 'mixed', keyRisks: [], recommendation: '' };
        }
        combinedPrediction.analysis.technicalFactors = [
          ...(combinedPrediction.analysis.technicalFactors || []),
          ...sectorFactors,
        ].slice(0, 6);

        if (yogaBonus > 10) {
          combinedPrediction.analysis.technicalFactors.push('D-10 Dashamsa: Strong Raj/Dhana yoga — supports upward momentum');
        } else if (yogaBonus < -10) {
          combinedPrediction.analysis.keyRisks = [
            ...(combinedPrediction.analysis.keyRisks || []),
            'D-10 Dashamsa: Arishta yoga active — increased downside risk',
          ];
        }

        if (transitImpact > 8) {
          combinedPrediction.analysis.technicalFactors.push(`Planetary transits: ${Math.round(transitImpact / 3)} benefic influences active`);
        } else if (transitImpact < -8) {
          combinedPrediction.analysis.keyRisks = [
            ...(combinedPrediction.analysis.keyRisks || []),
            `Planetary transits: ${Math.round(Math.abs(transitImpact) / 3)} malefic influences active`,
          ];
        }

        combinedPrediction.advancedAstro = {
          sector,
          sectorStrength:       advancedAstroResult.sectorStrength,
          planetarySupport:     advancedAstroResult.planetarySupport,
          timing,
          d10YogaBonus:         yogaBonus,
          transitImpact,
          sectorRecommendation: advancedAstroResult.recommendation,
        };
      }

      // Step 7: Apply feedback learning
      if (learningAdjustment) {
        combinedPrediction = feedbackLearningService.applyLearningToPrediction(combinedPrediction, learningAdjustment);
      }

      // Step 8: User personalization
      if (userId) {
        const personalization = await feedbackLearningService.getUserPersonalization(userId);
        combinedPrediction.userPersonalization = personalization;
        if (combinedPrediction.combinedConfidence !== undefined) {
          combinedPrediction.combinedConfidence = Math.min(95,
            combinedPrediction.combinedConfidence + (personalization.personalizedConfidenceBoost || 0)
          );
        }
      }

      // Step 9: Metadata
      combinedPrediction.metadata = {
        aiEnabled:            this.isConfigured() && aiPrediction !== null,
        astroEnabled:         true,
        advancedAstroEnabled: !!advancedAstroResult,
        d10Enabled:           !!d10Analysis,
        feedbackLearningApplied: true,
        predictionTime:       new Date().toISOString(),
        sector,
        sources: {
          ai:        aiPrediction ? 'Google Gemini 1.5 Flash' : 'Not available',
          astrology: 'Vedic — Hora, Tithi, Nakshatra, Planetary positions',
          advanced:  advancedAstroResult
            ? `D-10 Dashamsa + ${sector} Sector Analysis + Planetary Transits + Yoga Analysis`
            : 'Not available',
          feedback: learningAdjustment.suggestedFactors.length > 0 ? 'Active feedback learning' : 'No feedback data yet',
        },
      };

      return combinedPrediction;
    } catch (error) {
      console.error('Error generating enhanced prediction:', error);
      const fallbackAstro = await astrologyService.generateAstroPrediction(symbol, new Date(), currentPrice);
      return astrologyService.combineAIAndAstroPredictions(null, fallbackAstro, 0, currentPrice);
    }
  }

  // ── Crypto enhanced prediction ─────────────────────────────────────────────
  async generateEnhancedCryptoPrediction(
    cryptoSymbol: string, currentPrice: number, userId: string,
    historicalData: any[] = [], cryptoQuote?: any
  ): Promise<any> {
    try {
      const astroAnalysis       = await astrologyService.getCurrentAstrology(new Date());
      const userPersonalization = await feedbackLearningService.getUserPersonalization(userId);
      let aiPrediction: any = null;
      const metadata: any = { aiEnabled: false, feedbackLearningApplied: true, sources: ['astrology', 'feedback'] };

      if (this.isConfigured()) {
        try {
          const aiResponse = await geminiJSON(
            'You are an expert cryptocurrency analyst. Provide concise JSON predictions. Keep confidence max 80% due to crypto volatility.',
            `Analyze ${cryptoSymbol}: Price=$${currentPrice}, MarketCap=$${cryptoQuote?.marketCap?.toLocaleString() || 'N/A'}, 24hChange=${cryptoQuote?.changePercent24h?.toFixed(2) || 0}%, RecentData=${JSON.stringify(historicalData.slice(-5))}. Provide JSON: direction, confidence, priceTarget{low,high}, keyFactors, risks.`
          );
          if (aiResponse) {
            aiPrediction = this.parseAIPrediction(JSON.stringify(aiResponse), currentPrice);
            metadata.aiEnabled = true;
            metadata.sources.unshift('gemini');
          }
        } catch (aiError) { console.error('Gemini crypto error:', aiError); }
      }

      const astroStrength         = this.calculateCryptoAstroStrength(astroAnalysis, cryptoSymbol);
      const cryptoAstroPrediction = this.generateCryptoAstroPrediction(currentPrice, astroAnalysis, astroStrength);
      const combinedPrediction    = this.combineCryptoPredictions(aiPrediction, cryptoAstroPrediction, currentPrice);
      const personalizedPrediction = await feedbackLearningService.applyPersonalization(userId, `CRYPTO_${cryptoSymbol}`, combinedPrediction);

      return {
        ...personalizedPrediction,
        astroFactors: astroAnalysis,
        astroStrength,
        metadata,
        userPersonalization: userPersonalization
          ? { accuracyBoost: userPersonalization.personalizedConfidenceBoost, learningPhase: userPersonalization.bestTimeToTrade }
          : null,
        learningInsights: await feedbackLearningService.getStockMetrics(`CRYPTO_${cryptoSymbol}`),
      };
    } catch (error) {
      console.error('Enhanced crypto prediction error:', error);
      const fallbackAstro    = await astrologyService.getCurrentAstrology(new Date());
      const fallbackStrength = this.calculateCryptoAstroStrength(fallbackAstro, cryptoSymbol);
      return this.generateCryptoAstroPrediction(currentPrice, fallbackAstro, fallbackStrength);
    }
  }

  private parseAIPrediction(response: string, currentPrice: number): any {
    try {
      const d = JSON.parse(response);
      return {
        prediction: {
          direction:   d.direction || 'neutral',
          confidence:  Math.min(d.confidence || 60, 80),
          priceTarget: {
            low:  d.priceTarget?.low  || currentPrice * 0.95,
            high: d.priceTarget?.high || currentPrice * 1.05,
          },
          timeframe: d.timeframe || '24-72 hours',
        },
        analysis: {
          technicalFactors: d.keyFactors || [],
          marketSentiment:  d.marketSentiment || 'volatile',
          keyRisks:         d.risks || [],
          recommendation:   d.recommendation || 'Monitor closely',
        },
        reasoning: d.reasoning || 'Gemini AI crypto analysis',
      };
    } catch { return null; }
  }

  private calculateCryptoAstroStrength(astroAnalysis: any, cryptoSymbol: string): number {
    const map: Record<string, { planet: string; strength: number }> = {
      BTC:  { planet: 'Sun',     strength: 0.9  },
      ETH:  { planet: 'Mercury', strength: 0.85 },
      BNB:  { planet: 'Venus',   strength: 0.7  },
      ADA:  { planet: 'Jupiter', strength: 0.75 },
      SOL:  { planet: 'Mars',    strength: 0.8  },
      XRP:  { planet: 'Saturn',  strength: 0.6  },
      DOT:  { planet: 'Mercury', strength: 0.7  },
      MATIC:{ planet: 'Moon',    strength: 0.65 },
      AVAX: { planet: 'Mars',    strength: 0.75 },
      ATOM: { planet: 'Jupiter', strength: 0.7  },
    };
    const cd = map[cryptoSymbol] || { planet: 'Mercury', strength: 0.6 };
    return Math.min(((astroAnalysis.planetary?.[cd.planet.toLowerCase()] || 50) * cd.strength) * 0.85, 80);
  }

  private generateCryptoAstroPrediction(currentPrice: number, astroAnalysis: any, astroStrength: number): any {
    const pv  = (astroStrength - 50) / 100 * 1.6;
    const dir = pv > 0.05 ? 'bullish' : pv < -0.05 ? 'bearish' : 'neutral';
    return {
      prediction: {
        direction:   dir,
        priceTarget: {
          low:  Math.round(currentPrice * (1 - Math.abs(pv) * 0.12) * 100) / 100,
          high: Math.round(currentPrice * (1 + Math.abs(pv) * 0.12) * 100) / 100,
        },
      },
      confidence:          Math.round(astroStrength),
      finalDirection:      dir,
      astroRecommendation: dir === 'bullish'
        ? 'Positive cosmic energy — consider long position'
        : dir === 'bearish'
        ? 'Negative cosmic energy — reduce exposure'
        : 'Mixed signals — hold current position',
      reasoning: 'Vedic astrology analysis with crypto volatility adjustment',
    };
  }

  private combineCryptoPredictions(aiPrediction: any, astroPrediction: any, currentPrice: number): any {
    if (!aiPrediction) return astroPrediction;
    const aw = 0.35, sw = 0.65;
    const finalDir = astroPrediction.finalDirection || aiPrediction.prediction?.direction || 'neutral';
    return {
      prediction: {
        direction:   finalDir,
        priceTarget: {
          low:  Math.round(((aiPrediction.prediction?.priceTarget?.low  || currentPrice * 0.92) * aw + (astroPrediction.prediction?.priceTarget?.low  || currentPrice * 0.88) * sw) * 100) / 100,
          high: Math.round(((aiPrediction.prediction?.priceTarget?.high || currentPrice * 1.08) * aw + (astroPrediction.prediction?.priceTarget?.high || currentPrice * 1.12) * sw) * 100) / 100,
        },
      },
      combinedConfidence: Math.round((aiPrediction.confidence || 60) * aw + (astroPrediction.confidence || 50) * sw),
      confidence:         Math.round((aiPrediction.confidence || 60) * aw + (astroPrediction.confidence || 50) * sw),
      finalDirection:     finalDir,
      analysis:           aiPrediction.analysis,
      astroRecommendation: astroPrediction.astroRecommendation,
      reasoning:          `Combined Gemini AI (${aw * 100}%) + Astrology (${sw * 100}%) analysis`,
    };
  }

  async generateMarketInsights(marketData: any): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const prompt = `You are a concise market analyst for Indian equities. Provide 2-3 sentences of actionable insight.\n\nMarket data: NIFTY=${marketData.indices?.nifty50?.value}(${marketData.indices?.nifty50?.changePercent}%), SENSEX=${marketData.indices?.sensex?.value}(${marketData.indices?.sensex?.changePercent}%), Gainers: ${marketData.topGainers?.slice(0,3).map((s:any)=>s.symbol).join(',')}, Losers: ${marketData.topLosers?.slice(0,3).map((s:any)=>s.symbol).join(',')}. Respond in plain text only, no JSON.`;
      const result = await geminiFlash.generateContent(prompt);
      return result.response.text() || null;
    } catch (error) {
      console.error('Error generating market insights:', error);
      return null;
    }
  }
}

export const aiService = new AIService();
