// ─────────────────────────────────────────────────────────────────────────────
// aiService.ts
// Prediction pipeline: Statistical Analysis (50%) + Vedic Astrology (50%)
// AI (Groq llama-3.3-70b) interprets statistical results and combines with astro
// Falls back to Groq automatically when OpenAI quota is exhausted
// ─────────────────────────────────────────────────────────────────────────────

import OpenAI from 'openai';
import { stockDataService }          from './stockDataService';
import { feedbackLearningService }   from './feedbackLearningService';
import { astrologyService }          from './astrologyService';
import { advancedAstrologyService }  from './advancedAstrologyService';
import { statisticalAnalysisService, type StatisticalAnalysisResult } from './statisticalAnalysisService';

// ── Primary: OpenAI GPT-4o ────────────────────────────────────────────────────
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ── Fallback: Groq llama-3.3-70b (free, fast, no quota issues) ───────────────
const groqClient = new OpenAI({
  apiKey:   process.env.OPENAI_API_KEY || '',   // same env var on Render
  baseURL: 'https://api.groq.com/openai/v1',
});

// ── Stock → Sector mapping ────────────────────────────────────────────────────
const STOCK_SECTOR_MAP: Record<string, string> = {
  TCS: 'IT', INFY: 'IT', WIPRO: 'IT', HCLTECH: 'IT', TECHM: 'IT',
  HDFCBANK: 'Banking', ICICIBANK: 'Banking', SBIN: 'Banking', AXISBANK: 'Banking',
  KOTAKBANK: 'Banking', PNB: 'Banking', BANKBARODA: 'Banking', INDUSINDBK: 'Banking',
  YESBANK: 'Banking', CANBK: 'Banking', IDBI: 'Banking', BAJFINANCE: 'Banking',
  SUNPHARMA: 'Pharma', DRREDDY: 'Pharma', CIPLA: 'Pharma', DIVISLAB: 'Pharma', APOLLOHOSP: 'Pharma',
  ONGC: 'Energy', BPCL: 'Energy', IOC: 'Energy', POWERGRID: 'Energy', NTPC: 'Energy', ADANIGREEN: 'Energy', RELIANCE: 'Energy',
  MARUTI: 'Auto', TATAMOTORS: 'Auto', HEROMOTOCO: 'Auto', EICHERMOT: 'Auto', BAJAJFINSV: 'Auto',
  HINDUNILVR: 'FMCG', ITC: 'FMCG', NESTLEIND: 'FMCG', BRITANNIA: 'FMCG', TITAN: 'FMCG', ASIANPAINT: 'FMCG', DMART: 'FMCG', ZOMATO: 'FMCG', IRCTC: 'FMCG',
  TATASTEEL: 'Metals', JSWSTEEL: 'Metals', HINDALCO: 'Metals', VEDL: 'Metals', COALINDIA: 'Metals', ULTRACEMCO: 'Metals', GRASIM: 'Metals', LT: 'Metals',
  ADANIENT: 'Realty', ADANIPORTS: 'Realty',
  BHARTIARTL: 'IT', PAYTM: 'IT',
};

function getSector(symbol: string): string {
  return STOCK_SECTOR_MAP[symbol.toUpperCase()] || 'General';
}

// ── AI call with automatic Groq fallback ─────────────────────────────────────
async function callAI(
  systemPrompt: string,
  userPrompt:   string,
  maxTokens:    number = 900
): Promise<any> {
  // Try OpenAI first
  try {
    const res = await openaiClient.chat.completions.create({
      model:    'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens:  maxTokens,
    });
    const text = res.choices[0]?.message?.content;
    if (text) return JSON.parse(text);
  } catch (err: any) {
    // 429 = quota exceeded, 401 = bad key → fall through to Groq
    if (err?.status === 429 || err?.status === 401 || err?.code === 'insufficient_quota') {
      console.log('[AI] OpenAI quota exhausted — switching to Groq llama-3.3-70b');
    } else {
      console.error('[AI] OpenAI error:', err?.message || err);
    }
  }

  // Groq fallback — always available, no quota issues
  try {
    const res = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return valid JSON only. No markdown, no code fences.' },
        { role: 'user',   content: userPrompt   },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens:  maxTokens,
    });
    const text = res.choices[0]?.message?.content;
    if (text) return JSON.parse(text);
  } catch (groqErr: any) {
    console.error('[AI] Groq fallback also failed:', groqErr?.message || groqErr);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

interface AIAnalysis {
  direction:       'bullish' | 'bearish' | 'neutral';
  confidence:      number;
  priceTarget:     { low: number; high: number };
  technicalFactors: string[];
  marketSentiment: string;
  keyRisks:        string[];
  recommendation:  string;
  reasoning:       string;
  statsWeight:     number;  // how much stats contributed (0-1)
  astroWeight:     number;  // how much astro contributed (0-1)
}

export class AIService {

  // ── MAIN STOCK PREDICTION PIPELINE ───────────────────────────────────────
  async generateEnhancedPrediction(
    symbol:        string,
    currentPrice:  number,
    userId?:       string,
    historicalData?: any[]
  ): Promise<any> {
    console.log(`[Pipeline] Starting prediction for ${symbol} @ ₹${currentPrice}`);
    const sector = getSector(symbol);

    // ── Step 1: Feedback learning ─────────────────────────────────────────
    const learningAdjustment = await feedbackLearningService
      .getLearningAdjustments(symbol, userId || '')
      .catch(() => ({ confidenceAdjustment: 0, suggestedFactors: [] }));

    // ── Step 2: Statistical analysis (50% weight) ─────────────────────────
    let statsResult: StatisticalAnalysisResult | null = null;
    try {
      const bars = statisticalAnalysisService.normalizeYahooData(historicalData || []);
      if (bars.length >= 10) {
        statsResult = statisticalAnalysisService.analyzeHistoricalData(symbol, bars);
        console.log(`[Stats] ${symbol}: score=${statsResult?.statisticalScore}, signal=${statsResult?.statisticalSignal}, bars=${bars.length}`);
      } else {
        console.log(`[Stats] Not enough bars for ${symbol}: ${bars.length}`);
      }
    } catch (statsErr) {
      console.error('[Stats] Statistical analysis error:', statsErr);
    }

    // ── Step 3: Vedic Astrology (50% weight) ─────────────────────────────
    const astroPrediction = await astrologyService
      .generateAstroPrediction(symbol, new Date(), currentPrice)
      .catch(() => null);

    // ── Step 4: Advanced astrology (D-10, Sector, Transits, Yogas) ───────
    let advancedAstroResult: any = null;
    let yogaBonus    = 0;
    let transitImpact = 0;

    try {
      advancedAstroResult = await advancedAstrologyService.analyzeStockBySector(symbol, sector, new Date());
      const d1Chart    = advancedAstrologyService.generateD1Chart(new Date(), '09:15', 19.0760, 72.8777);
      const d10Analysis = advancedAstrologyService.generateD10Chart(d1Chart);
      const careerYogas = d10Analysis?.yogas || [];
      yogaBonus = Math.max(-20, Math.min(20, Math.round(
        careerYogas.reduce((sum: number, yoga: any) => {
          if (yoga.type === 'rajyoga')  return sum + Math.min(yoga.strength * 0.15, 15);
          if (yoga.type === 'dhanyoga') return sum + Math.min(yoga.strength * 0.10, 10);
          if (yoga.type === 'arishta')  return sum - Math.min(yoga.strength * 0.10, 10);
          return sum;
        }, 0)
      )));
      const transits    = advancedAstrologyService.calculateTransits(d1Chart, new Date());
      const benefic     = transits.filter((t: any) => t.effect === 'beneficial').length;
      const malefic     = transits.filter((t: any) => t.effect === 'malefic').length;
      transitImpact     = Math.max(-15, Math.min(15, (benefic - malefic) * 3));
      console.log(`[AdvAstro] ${symbol}: timing=${advancedAstroResult?.timing}, yoga=${yogaBonus}, transit=${transitImpact}`);
    } catch (advErr) {
      console.error('[AdvAstro] Non-fatal error:', advErr);
    }

    // ── Step 5: AI interprets statistics ─────────────────────────────────
    let aiStatsAnalysis: any = null;
    if (statsResult) {
      aiStatsAnalysis = await this.interpretStatisticsWithAI(symbol, currentPrice, statsResult, sector);
    }

    // ── Step 6: Combine Statistical (50%) + Astrological (50%) ───────────
    const combined = this.combineStatsAndAstro(
      statsResult, astroPrediction, advancedAstroResult,
      aiStatsAnalysis, yogaBonus, transitImpact,
      currentPrice, sector, learningAdjustment
    );

    // ── Step 7: Feedback learning ─────────────────────────────────────────
    let finalPrediction = combined;
    try {
      finalPrediction = feedbackLearningService.applyLearningToPrediction(combined, learningAdjustment);
    } catch { /* non-fatal */ }

    // ── Step 8: User personalization ──────────────────────────────────────
    if (userId) {
      try {
        const pers = await feedbackLearningService.getUserPersonalization(userId);
        finalPrediction.userPersonalization = pers;
        if (finalPrediction.combinedConfidence !== undefined) {
          finalPrediction.combinedConfidence = Math.min(95,
            finalPrediction.combinedConfidence + (pers.personalizedConfidenceBoost || 0)
          );
        }
      } catch { /* non-fatal */ }
    }

    // ── Step 9: Metadata ─────────────────────────────────────────────────
    finalPrediction.metadata = {
      aiEnabled:            aiStatsAnalysis !== null,
      astroEnabled:         astroPrediction !== null,
      advancedAstroEnabled: advancedAstroResult !== null,
      statsEnabled:         statsResult !== null,
      feedbackLearningApplied: true,
      predictionTime:       new Date().toISOString(),
      sector,
      weighting: {
        statistical: '50%',
        astrological: '50%',
      },
      sources: {
        statistics:  statsResult ? `${statsResult.analysedBars} bars of OHLCV data (RSI, MACD, BB, MA, Volume, ADX)` : 'No historical data available',
        astrology:   'Vedic — Hora, Tithi, Nakshatra, Planetary positions',
        advanced:    advancedAstroResult ? `D-10 Dashamsa + ${sector} Sector + Transits + Yogas` : 'Not available',
        ai:          aiStatsAnalysis ? 'AI statistical interpretation (OpenAI GPT-4o / Groq fallback)' : 'Not available',
        feedback:    learningAdjustment.suggestedFactors?.length > 0 ? 'Active feedback learning' : 'No feedback data yet',
      },
    };

    return finalPrediction;
  }

  // ── AI interprets the statistical analysis results ────────────────────────
  private async interpretStatisticsWithAI(
    symbol:      string,
    price:       number,
    stats:       StatisticalAnalysisResult,
    sector:      string
  ): Promise<any> {
    const systemPrompt = `You are a quantitative analyst specializing in Indian equities (NSE/BSE).
You receive a full set of technical indicators computed from historical price data.
Your job: interpret these indicators, identify the strongest signals, assess conviction, and produce a precise price prediction.
Respond with valid JSON only. No markdown.`;

    const userPrompt = `Analyze ${symbol} (${sector} sector) at ₹${price}:

STATISTICAL INDICATORS:
- RSI(14): ${stats.rsi.value.toFixed(1)} → ${stats.rsi.signal}
- MACD: line=${stats.macd.macdLine}, signal=${stats.macd.signalLine}, histogram=${stats.macd.histogram} → ${stats.macd.signal} (${stats.macd.crossover})
- Bollinger Bands: upper=₹${stats.bollingerBands.upper}, mid=₹${stats.bollingerBands.middle}, lower=₹${stats.bollingerBands.lower} → price is ${stats.bollingerBands.pricePosition}, bandwidth=${stats.bollingerBands.bandwidth}%
- Moving Averages: SMA20=₹${stats.movingAverages.sma20?.toFixed(2)}, SMA50=₹${stats.movingAverages.sma50?.toFixed(2)}, EMA21=₹${stats.movingAverages.ema21?.toFixed(2)} → trend: ${stats.movingAverages.trend}${stats.movingAverages.goldenCross ? ' (GOLDEN CROSS!)' : ''}${stats.movingAverages.deathCross ? ' (DEATH CROSS!)' : ''}
- Volume: ratio=${stats.volume.volumeRatio}x avg, VWAP=₹${stats.volume.vwap}, OBV=${stats.volume.obv > 0 ? '+' : ''}${stats.volume.obv.toLocaleString()}
- Support: ₹${stats.supportResistance.nearestSupport} (${stats.supportResistance.distToSupport}% away), Resistance: ₹${stats.supportResistance.nearestResistance} (${stats.supportResistance.distToResistance}% away)
- Momentum: ROC5=${stats.momentum.roc5}%, ROC10=${stats.momentum.roc10}%, Stoch-K=${stats.momentum.stochK}, CCI=${stats.momentum.cci}
- Volatility: daily=${stats.volatility.dailyVolatility}%, ATR=₹${stats.volatility.atr} (${stats.volatility.atrPercent}%), beta≈${stats.volatility.beta}
- Trend Strength: ADX=${stats.trendStrength.adx} (${stats.trendStrength.trendStrength}), +DI=${stats.trendStrength.plusDI}, -DI=${stats.trendStrength.minusDI}
- Statistical Score: ${stats.statisticalScore}/100 → ${stats.statisticalSignal}
- Bars analysed: ${stats.analysedBars}

Key findings: ${stats.keyFindings.join('; ')}
Key risks: ${stats.keyRisks.join('; ')}

Return JSON:
{
  "direction": "bullish|bearish|neutral",
  "confidence": <number 30-90>,
  "priceTarget": { "low": <number>, "high": <number> },
  "timeframe": "1-7 days",
  "technicalFactors": ["<factor1>", "<factor2>", "<factor3>"],
  "keyRisks": ["<risk1>", "<risk2>"],
  "marketSentiment": "<one sentence>",
  "recommendation": "<action>",
  "reasoning": "<2 sentence explanation of the dominant signals>",
  "strongestSignal": "<the single most decisive indicator>",
  "priceTargetBasis": "<how you calculated the price targets>"
}`;

    const result = await callAI(systemPrompt, userPrompt, 800);
    if (!result) return null;

    return {
      direction:        result.direction        || stats.statisticalSignal,
      confidence:       Math.min(90, Math.max(30, result.confidence || stats.statisticalConfidence)),
      priceTarget:      result.priceTarget      || { low: price * 0.97, high: price * 1.03 },
      technicalFactors: result.technicalFactors || stats.keyFindings,
      keyRisks:         result.keyRisks         || stats.keyRisks,
      marketSentiment:  result.marketSentiment  || stats.technicalSummary,
      recommendation:   result.recommendation   || 'Hold and monitor',
      reasoning:        result.reasoning        || stats.technicalSummary,
      strongestSignal:  result.strongestSignal  || '',
    };
  }

  // ── Combine Stats (50%) + Astro (50%) ────────────────────────────────────
  private combineStatsAndAstro(
    statsResult:        StatisticalAnalysisResult | null,
    astroPrediction:    any,
    advancedAstro:      any,
    aiStatsAnalysis:    any,
    yogaBonus:          number,
    transitImpact:      number,
    currentPrice:       number,
    sector:             string,
    learningAdjustment: any
  ): any {

    // ── Statistical side ─────────────────────────────────────────────────
    const statsScore      = statsResult?.statisticalScore       ?? 50;
    const statsConfidence = aiStatsAnalysis?.confidence         ?? statsResult?.statisticalConfidence ?? 50;
    const statsDir        = aiStatsAnalysis?.direction          ?? statsResult?.statisticalSignal     ?? 'neutral';
    const statsLow        = aiStatsAnalysis?.priceTarget?.low   ?? (currentPrice * 0.975);
    const statsHigh       = aiStatsAnalysis?.priceTarget?.high  ?? (currentPrice * 1.025);

    // ── Astrological side ────────────────────────────────────────────────
    const astroScore = astroPrediction
      ? (astroPrediction.strength ?? 50)
      : 50;
    const astroConfidence = astroPrediction?.confidence ?? 50;
    const astroDir        = astroPrediction?.direction  ?? 'neutral';

    // Advanced astro modifiers
    let astroSectorBoost = 0;
    let sectorTiming: string = 'neutral';
    if (advancedAstro) {
      const sectorStrength = advancedAstro.sectorStrength ?? 50;
      astroSectorBoost     = Math.round(((sectorStrength - 50) / 50) * 12);
      sectorTiming         = advancedAstro.timing ?? 'neutral';
    }

    // ── Directional resolution ────────────────────────────────────────────
    // If both agree → use that direction with boosted confidence
    // If they disagree → use statistical direction (data > stars for short term),
    //   but reduce confidence significantly
    let finalDirection: 'bullish' | 'bearish' | 'neutral';
    let directionAgreement = false;

    if (statsDir === astroDir) {
      finalDirection = statsDir;
      directionAgreement = true;
    } else if (statsDir === 'neutral') {
      finalDirection = astroDir;
    } else if (astroDir === 'neutral') {
      finalDirection = statsDir;
    } else {
      // Direct conflict: stats wins for short-term, astro wins for longer-term
      // For now, take the statistically stronger signal
      finalDirection = statsScore > 50 && statsDir === 'bullish' ? 'bullish'
        : statsScore < 50 && statsDir === 'bearish' ? 'bearish'
        : 'neutral';
    }

    // ── Confidence calculation (50-50 weighted) ───────────────────────────
    let combinedConfidence = Math.round(
      statsConfidence  * 0.50 +
      astroConfidence  * 0.50 +
      astroSectorBoost +
      yogaBonus       +
      transitImpact   +
      (learningAdjustment.confidenceAdjustment ?? 0)
    );

    // Agreement bonus: both agree = +8 confidence
    if (directionAgreement && statsDir !== 'neutral') combinedConfidence += 8;
    // Conflict penalty: disagreement = -10 confidence
    if (!directionAgreement && statsDir !== 'neutral' && astroDir !== 'neutral') combinedConfidence -= 10;

    combinedConfidence = Math.min(95, Math.max(30, combinedConfidence));

    // ── Price targets (blend stats and astro range) ───────────────────────
    const riskMultiplier = finalDirection === 'bullish' ? 0.025
      : finalDirection === 'bearish' ? 0.025 : 0.02;

    // Use AI stats targets if available, else compute from astro risk band
    const astroLow  = currentPrice * (1 - riskMultiplier);
    const astroHigh = currentPrice * (1 + riskMultiplier);

    // 50-50 blend of stats and astro price targets
    const blendedLow  = Math.round(((statsLow  * 0.5) + (astroLow  * 0.5)) * 100) / 100;
    const blendedHigh = Math.round(((statsHigh * 0.5) + (astroHigh * 0.5)) * 100) / 100;

    // ── ★ SEPARATE Statistical and Astrological factors ───────────────────
    // STATISTICAL FACTORS (pure technical analysis - NO astro)
    const statsTechFactors = aiStatsAnalysis?.technicalFactors ?? statsResult?.keyFindings ?? [];
    
    // ASTROLOGICAL FACTORS (pure astro - NO technical)
    const astroKeyFactors: string[] = [];
    if (advancedAstro?.keyFactors) {
      astroKeyFactors.push(...(advancedAstro.keyFactors.slice(0, 2).map((f: string) => `[${sector}] ${f}`)));
    }
    
    // Yoga / Transit factor labels (ASTROLOGICAL)
    if (yogaBonus > 10)    astroKeyFactors.push('D-10: Strong Raj/Dhana Yoga supports momentum');
    if (transitImpact > 8) astroKeyFactors.push(`Planetary transits: ${Math.round(transitImpact / 3)} benefic influences active`);

    // ── ★ SEPARATE Statistical and Astrological risks ─────────────────────
    // STATISTICAL RISKS
    const statsRisks = aiStatsAnalysis?.keyRisks ?? statsResult?.keyRisks ?? [];
    
    // ASTROLOGICAL RISKS
    const astroRisks = [...(astroPrediction?.warnings ?? [])];
    if (yogaBonus < -10)    astroRisks.push('D-10: Arishta Yoga — increased downside risk');
    if (transitImpact < -8) astroRisks.push(`Planetary transits: ${Math.round(Math.abs(transitImpact) / 3)} malefic influences`);
    
    // Combined risks for display (but keep separate in data structure)
    const allRisks = [...statsRisks.slice(0, 2), ...astroRisks.slice(0, 2)].slice(0, 4);

    // ── Sector timing direction softening ─────────────────────────────────
    if (sectorTiming === 'excellent' && finalDirection === 'bearish') finalDirection = 'neutral';
    if (sectorTiming === 'challenging' && finalDirection === 'bullish') finalDirection = 'neutral';

    // ── Reasoning ─────────────────────────────────────────────────────────
    const statsReasonPart = aiStatsAnalysis?.reasoning ?? statsResult?.technicalSummary ?? '';
    const astroReasonPart = astroPrediction?.recommendation ?? '';
    const reasoning = [statsReasonPart, astroReasonPart].filter(Boolean).join(' | Astro: ');

    return {
      prediction: {
        direction: finalDirection,
        confidence: combinedConfidence,
        priceTarget: { low: blendedLow, high: blendedHigh },
        timeframe: '1-7 days',
      },
      combinedConfidence,
      finalDirection,

      // Statistical breakdown
      statisticalAnalysis: statsResult ? {
        score:      statsResult.statisticalScore,
        signal:     statsResult.statisticalSignal,
        confidence: statsConfidence,
        rsi:        statsResult.rsi,
        macd:       statsResult.macd,
        trend:      statsResult.movingAverages.trend,
        adx:        statsResult.trendStrength.adx,
        support:    statsResult.supportResistance.nearestSupport,
        resistance: statsResult.supportResistance.nearestResistance,
        volatility: statsResult.volatility.annualizedVol,
        barsUsed:   statsResult.analysedBars,
      } : null,

      // Astrology breakdown
      astrologyAnalysis: astroPrediction ? {
        score:      astroScore,
        signal:     astroDir,
        confidence: astroConfidence,
        factors:    astroPrediction.factors,
        sectorTiming,
        yogaBonus,
        transitImpact,
        sectorStrength: advancedAstro?.sectorStrength ?? null,
      } : null,

      // Weighting
      weighting: {
        statistical:  50,
        astrological: 50,
        directionAgreement,
        conflictResolution: !directionAgreement && statsDir !== 'neutral' && astroDir !== 'neutral'
          ? `Stats(${statsDir}) vs Astro(${astroDir}) — resolved to ${finalDirection}`
          : 'No conflict',
      },

      // ★ Output fields for frontend - SEPARATED stats and astro
      analysis: {
        technicalFactors:     statsTechFactors.slice(0, 5),     // ★ PURE STATS ONLY
        astrologicalFactors:  astroKeyFactors.slice(0, 5),      // ★ PURE ASTRO ONLY
        marketSentiment:      aiStatsAnalysis?.marketSentiment ?? statsResult?.technicalSummary ?? 'Mixed signals',
        keyRisks:             allRisks,                         // Combined for display
        statisticalRisks:     statsRisks,                       // ★ PURE STATS RISKS
        astrologicalRisks:    astroRisks,                       // ★ PURE ASTRO RISKS
        recommendation:       aiStatsAnalysis?.recommendation  ?? astroPrediction?.recommendation ?? 'Monitor closely',
      },
      astroRecommendation: astroPrediction?.recommendation ?? '',
      warnings:            allRisks,
      reasoning,
    };
  }

  // ── CRYPTO PREDICTION ─────────────────────────────────────────────────────
  async generateEnhancedCryptoPrediction(
    cryptoSymbol:   string,
    currentPrice:   number,
    userId:         string,
    historicalData: any[] = [],
    cryptoQuote?:   any
  ): Promise<any> {
    // ── Statistical analysis of crypto historical data ────────────────────
    let statsResult: StatisticalAnalysisResult | null = null;
    try {
      const bars = statisticalAnalysisService.normalizeFinnhubData(
        // Try Finnhub format first, then Yahoo format
        historicalData[0]?.t ? { t: historicalData.map(d => d.timestamp), c: historicalData.map(d => d.close), h: historicalData.map(d => d.high), l: historicalData.map(d => d.low), o: historicalData.map(d => d.open), v: historicalData.map(d => d.volume) }
        : null
      );
      const yahooBars = bars.length < 5
        ? statisticalAnalysisService.normalizeYahooData(historicalData)
        : bars;

      if (yahooBars.length >= 10) {
        statsResult = statisticalAnalysisService.analyzeHistoricalData(cryptoSymbol, yahooBars);
        console.log(`[Stats] Crypto ${cryptoSymbol}: score=${statsResult?.statisticalScore}, bars=${yahooBars.length}`);
      }
    } catch (err) {
      console.error('[Stats] Crypto stats error:', err);
    }

    const astroAnalysis = await astrologyService.getCurrentAstrology(new Date());
    const userPers      = await feedbackLearningService.getUserPersonalization(userId).catch(() => null);

    // AI interprets crypto stats
    let aiStatsAnalysis: any = null;
    if (statsResult) {
      aiStatsAnalysis = await this.interpretStatisticsWithAI(cryptoSymbol, currentPrice, statsResult, 'Crypto');
    }

    // Astro score for crypto
    const astroStrength = this.calcCryptoAstroStrength(astroAnalysis, cryptoSymbol);
    const astroDir: 'bullish' | 'bearish' | 'neutral' =
      astroStrength > 60 ? 'bullish' : astroStrength < 40 ? 'bearish' : 'neutral';

    // 50-50 blend
    const statsScore = statsResult?.statisticalScore ?? 50;
    const statsDir   = aiStatsAnalysis?.direction ?? statsResult?.statisticalSignal ?? 'neutral';
    const statsConf  = aiStatsAnalysis?.confidence ?? statsResult?.statisticalConfidence ?? 50;

    let finalDir: 'bullish' | 'bearish' | 'neutral' =
      statsDir === astroDir ? statsDir : statsDir !== 'neutral' ? statsDir : astroDir;

    const combinedConf = Math.min(80, Math.round((statsConf * 0.5 + astroStrength * 0.5)));

    const statsLow  = aiStatsAnalysis?.priceTarget?.low  ?? currentPrice * 0.92;
    const statsHigh = aiStatsAnalysis?.priceTarget?.high ?? currentPrice * 1.08;
    const astroLow  = currentPrice * (1 - 0.06);
    const astroHigh = currentPrice * (1 + 0.06);

    const blendedLow  = Math.round(((statsLow  * 0.5) + (astroLow  * 0.5)) * 100) / 100;
    const blendedHigh = Math.round(((statsHigh * 0.5) + (astroHigh * 0.5)) * 100) / 100;

    const techFactors = [
      ...(aiStatsAnalysis?.technicalFactors ?? statsResult?.keyFindings ?? []).slice(0, 3),
    ];
    const risks = [
      ...(aiStatsAnalysis?.keyRisks ?? statsResult?.keyRisks ?? []).slice(0, 2),
      'Crypto markets are highly volatile — always use stop-loss',
    ];

    return {
      prediction: { direction: finalDir, priceTarget: { low: blendedLow, high: blendedHigh } },
      combinedConfidence: combinedConf,
      confidence:         combinedConf,
      finalDirection:     finalDir,
      analysis: {
        technicalFactors: techFactors,
        marketSentiment:  aiStatsAnalysis?.marketSentiment ?? 'Volatile crypto market',
        keyRisks:         risks,
        recommendation:   aiStatsAnalysis?.recommendation ?? 'Monitor closely with stop-loss',
      },
      astroRecommendation: `Astro score: ${astroStrength.toFixed(0)}/100 → ${astroDir}`,
      warnings:    risks,
      reasoning:   aiStatsAnalysis?.reasoning ?? statsResult?.technicalSummary ?? 'Statistical + astrological analysis',
      statisticalAnalysis: statsResult ? {
        score: statsResult.statisticalScore, signal: statsResult.statisticalSignal,
        rsi: statsResult.rsi, macd: statsResult.macd, trend: statsResult.movingAverages.trend,
      } : null,
      astroFactors:       astroAnalysis,
      astroStrength,
      metadata: {
        aiEnabled:    aiStatsAnalysis !== null,
        statsEnabled: statsResult !== null,
        weighting:    { statistical: '50%', astrological: '50%' },
        sources: {
          statistics: statsResult ? `${statsResult.analysedBars} bars` : 'No historical data',
          astrology:  'Vedic astrology',
          ai:         aiStatsAnalysis ? 'OpenAI/Groq' : 'Not available',
        },
      },
      userPersonalization: userPers ? { accuracyBoost: userPers.personalizedConfidenceBoost } : null,
    };
  }

  private calcCryptoAstroStrength(astroAnalysis: any, symbol: string): number {
    const map: Record<string, number> = {
      BTC: 0.9, ETH: 0.85, BNB: 0.7, ADA: 0.75, SOL: 0.8,
      XRP: 0.6, DOT: 0.7, MATIC: 0.65, AVAX: 0.75, ATOM: 0.7,
    };
    const base = (astroAnalysis.planetary?.mercury || 50);
    return Math.min(80, base * (map[symbol] || 0.65));
  }

  async generateMarketInsights(marketData: any): Promise<string | null> {
    const result = await callAI(
      'You are a concise market analyst. Provide brief, actionable market insights in 2-3 sentences.',
      `Market: NIFTY=${marketData.indices?.nifty50?.value}(${marketData.indices?.nifty50?.changePercent}%), SENSEX=${marketData.indices?.sensex?.value}(${marketData.indices?.sensex?.changePercent}%), Gainers: ${marketData.topGainers?.slice(0,3).map((s:any)=>s.symbol).join(',')}, Losers: ${marketData.topLosers?.slice(0,3).map((s:any)=>s.symbol).join(',')}. Provide JSON: {"insight": "..."}`,
      150
    );
    return result?.insight || null;
  }
}

export const aiService = new AIService();
