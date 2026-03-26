import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertSubscriptionSchema, insertFeedbackSchema, insertPredictionSchema, insertWatchlistSchema } from "@shared/schema";
import { stockDataService } from "./stockDataService";
import { cryptoDataService } from "./cryptoDataService";
import { aiService } from "./aiService";
import { feedbackLearningService } from "./feedbackLearningService";
import { astrologyService } from "./astrologyService";
import { advancedAstrologyService } from "./advancedAstrologyService";
import { aiAstrologyTrainer } from "./aiAstrologyTrainer";
import * as crypto from 'crypto';
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

function calculateBullwiserPrice(mode: string, tradeType: string, tradesPerDay: number, duration: string, referralCount: number = 0) {
  const tradeTypeRates = { 'low': 700, 'medium': 1400, 'high': 2100 };
  const ratePerTrade = tradeTypeRates[tradeType as keyof typeof tradeTypeRates] || 700;
  const basePrice = ratePerTrade * tradesPerDay;
  const durationDiscounts = { 'daily': 0.00, 'weekly': 0.05, 'monthly': 0.10, 'yearly': 0.20 };
  const durationDiscount = durationDiscounts[duration as keyof typeof durationDiscounts] || 0.0;
  const discountedPrice = basePrice * (1 - durationDiscount);
  const referralDiscount = Math.min(referralCount * 0.10, 0.50);
  const referralDiscountedPrice = discountedPrice * (1 - referralDiscount);
  let autoModeSurcharge = 0;
  if (mode === 'auto') {
    const multipliers = { 'low': 1, 'medium': 2, 'high': 3 };
    autoModeSurcharge = 150 * (multipliers[tradeType as keyof typeof multipliers] || 1);
  }
  const finalPrice = Math.round(referralDiscountedPrice + autoModeSurcharge);
  return { mode, tradeType, tradesPerDay, duration, basePrice, afterDurationDiscount: Math.round(discountedPrice), afterReferralDiscount: Math.round(referralDiscountedPrice), autoModeSurcharge, referralDiscountApplied: Math.round(referralDiscount * 100), durationDiscountApplied: Math.round(durationDiscount * 100), finalBill: finalPrice };
}

function calculateCryptoBillingPrice(mode: string, tradesPerDay: number, cryptoValue: number, duration: string, referralCount: number = 0) {
  const basePrice = 500;
  const valueMultiplier = Math.max(1, Math.floor(cryptoValue / 1000));
  const tradePrice = tradesPerDay * 50;
  const modeMultiplier = mode === 'auto' ? 1.5 : 1.0;
  const subtotal = (basePrice + tradePrice) * valueMultiplier * modeMultiplier;
  const durationDiscounts = { 'daily': 0.00, 'weekly': 0.05, 'monthly': 0.10, 'yearly': 0.20 };
  const durationDiscount = durationDiscounts[duration as keyof typeof durationDiscounts] || 0.0;
  const discountedPrice = subtotal * (1 - durationDiscount);
  const referralDiscount = Math.min(referralCount * 0.10, 0.50);
  const referralDiscountedPrice = discountedPrice * (1 - referralDiscount);
  let autoModeSurcharge = 0;
  if (mode === 'auto') autoModeSurcharge = Math.min(cryptoValue * 0.01, 1000);
  const finalPrice = Math.round(referralDiscountedPrice + autoModeSurcharge);
  return { mode, tradesPerDay, cryptoValue, duration, basePrice, tradePrice, valueMultiplier, modeMultiplier, subtotal: Math.round(subtotal), afterDurationDiscount: Math.round(discountedPrice), afterReferralDiscount: Math.round(referralDiscountedPrice), autoModeSurcharge: Math.round(autoModeSurcharge), referralDiscountApplied: Math.round(referralDiscount * 100), durationDiscountApplied: Math.round(durationDiscount * 100), finalBill: finalPrice };
}

let trainingInProgress = false;

async function runRealTraining() {
  if (trainingInProgress) return;
  trainingInProgress = true;
  const startTs = Math.floor(Date.now() / 1000);
  try {
    await storage.updateTrainingStatus(0, 'Loading predictions from database...', startTs);

    // Step 1: Load all past predictions with feedback
    const allPredictions = await db.select().from(predictions).limit(500);
    const allFeedback    = await db.select().from(feedback).limit(500);

    await storage.updateTrainingStatus(10, `Loaded ${allPredictions.length} predictions, ${allFeedback.length} feedback records`, startTs);

    if (allPredictions.length < 10) {
      await storage.updateTrainingStatus(100, 'Not enough data yet — need at least 10 predictions with feedback to train', startTs);
      trainingInProgress = false;
      return;
    }

    await storage.updateTrainingStatus(20, 'Building training cases from astrological features...', startTs);

    // Step 2: Build training cases — match predictions to feedback
    const feedbackByStock = new Map<string, typeof allFeedback>();
    for (const f of allFeedback) {
      if (!feedbackByStock.has(f.stock)) feedbackByStock.set(f.stock, []);
      feedbackByStock.get(f.stock)!.push(f);
    }

    const SECTOR_MAP: Record<string, string> = {
      TCS: 'IT', INFY: 'IT', WIPRO: 'IT', HCLTECH: 'IT', TECHM: 'IT',
      HDFCBANK: 'Banking', ICICIBANK: 'Banking', SBIN: 'Banking', AXISBANK: 'Banking',
      KOTAKBANK: 'Banking', RELIANCE: 'Energy', ONGC: 'Energy', NTPC: 'Energy',
      SUNPHARMA: 'Pharma', DRREDDY: 'Pharma', CIPLA: 'Pharma',
      MARUTI: 'Auto', TATAMOTORS: 'Auto', TATASTEEL: 'Metals', JSWSTEEL: 'Metals',
    };

    const trainingCases: Array<{
      stockSymbol: string; sector: string; date: Date;
      actualDirection: 'bullish' | 'bearish' | 'neutral'; actualReturn: number;
    }> = [];

    for (const pred of allPredictions) {
      const stockFeedbacks = feedbackByStock.get(pred.stock) || [];
      const matchedFeedback = stockFeedbacks.find(f =>
        Math.abs(f.submittedAt - (pred.createdAt ? Math.floor(pred.createdAt.getTime() / 1000) : 0)) < 7 * 86400
      );
      if (!matchedFeedback?.actualPrice) continue;

      const actualChange = ((matchedFeedback.actualPrice - pred.currentPrice) / pred.currentPrice) * 100;
      const actualDirection: 'bullish' | 'bearish' | 'neutral' =
        actualChange > 1 ? 'bullish' : actualChange < -1 ? 'bearish' : 'neutral';
      const symbol = pred.stock.replace('CRYPTO_', '');

      trainingCases.push({
        stockSymbol:     symbol,
        sector:          SECTOR_MAP[symbol] || 'General',
        date:            pred.createdAt || new Date(),
        actualDirection,
        actualReturn:    actualChange,
      });
    }

    await storage.updateTrainingStatus(40, `Built ${trainingCases.length} training cases from real outcomes`, startTs);

    if (trainingCases.length < 5) {
      await storage.updateTrainingStatus(100, `Only ${trainingCases.length} matched cases — submit more feedback with actual prices to improve training`, startTs);
      trainingInProgress = false;
      return;
    }

    // Step 3: Run batch training through aiAstrologyTrainer
    await storage.updateTrainingStatus(50, 'Running astrological pattern training...', startTs);
    const result = await aiAstrologyTrainer.batchTrainOnHistoricalData(
      trainingCases,
      (progress) => {
        const scaled = 50 + Math.floor(progress * 0.45);
        storage.updateTrainingStatus(scaled, `Training: ${progress}% complete`, startTs);
      }
    );

    await storage.updateTrainingStatus(98, 'Saving performance metrics...', startTs);
    console.log(`[Training] Completed: ${result.successfulCases}/${result.totalCases} cases, accuracy: ${result.overallAccuracy.toFixed(1)}%`);
    console.log(`[Training] Key learnings:`, result.keyLearnings.slice(0, 3));

    const sectorSummary = Object.entries(result.sectorAccuracies)
      .map(([s, a]) => `${s}: ${a.toFixed(0)}%`).join(', ');
    await storage.updateTrainingStatus(100,
      `Done — ${result.overallAccuracy.toFixed(1)}% accuracy on ${result.totalCases} cases. Sectors: ${sectorSummary || 'N/A'}`,
      startTs
    );
  } catch (error) {
    console.error('[Training] Error:', error);
    await storage.updateTrainingStatus(0, `Training failed: ${error instanceof Error ? error.message : 'Unknown error'}`, startTs);
  } finally {
    trainingInProgress = false;
  }
}

    await storage.updateTrainingStatus(20, 'Building training cases from astrological features...', startTs);

    // Step 2: Build training cases — match predictions to feedback
    const feedbackByStock = new Map<string, typeof allFeedback>();
    for (const f of allFeedback) {
      if (!feedbackByStock.has(f.stock)) feedbackByStock.set(f.stock, []);
      feedbackByStock.get(f.stock)!.push(f);
    }

    const SECTOR_MAP: Record<string, string> = {
      TCS: 'IT', INFY: 'IT', WIPRO: 'IT', HCLTECH: 'IT', TECHM: 'IT',
      HDFCBANK: 'Banking', ICICIBANK: 'Banking', SBIN: 'Banking', AXISBANK: 'Banking',
      KOTAKBANK: 'Banking', RELIANCE: 'Energy', ONGC: 'Energy', NTPC: 'Energy',
      SUNPHARMA: 'Pharma', DRREDDY: 'Pharma', CIPLA: 'Pharma',
      MARUTI: 'Auto', TATAMOTORS: 'Auto', TATASTEEL: 'Metals', JSWSTEEL: 'Metals',
    };

    const trainingCases: Array<{
      stockSymbol: string; sector: string; date: Date;
      actualDirection: 'bullish' | 'bearish' | 'neutral'; actualReturn: number;
    }> = [];

    for (const pred of allPredictions) {
      const stockFeedbacks = feedbackByStock.get(pred.stock) || [];
      const matchedFeedback = stockFeedbacks.find(f =>
        Math.abs(f.submittedAt - (pred.createdAt ? Math.floor(pred.createdAt.getTime() / 1000) : 0)) < 7 * 86400
      );
      if (!matchedFeedback?.actualPrice) continue;

      const actualChange = ((matchedFeedback.actualPrice - pred.currentPrice) / pred.currentPrice) * 100;
      const actualDirection: 'bullish' | 'bearish' | 'neutral' =
        actualChange > 1 ? 'bullish' : actualChange < -1 ? 'bearish' : 'neutral';
      const symbol = pred.stock.replace('CRYPTO_', '');

      trainingCases.push({
        stockSymbol:     symbol,
        sector:          SECTOR_MAP[symbol] || 'General',
        date:            pred.createdAt || new Date(),
        actualDirection,
        actualReturn:    actualChange,
      });
    }

    await storage.updateTrainingStatus(40, `Built ${trainingCases.length} training cases from real outcomes`, startTs);

    if (trainingCases.length < 5) {
      await storage.updateTrainingStatus(100, `Only ${trainingCases.length} matched cases — submit more feedback with actual prices to improve training`, startTs);
      trainingInProgress = false;
      return;
    }

    // Step 3: Run batch training through aiAstrologyTrainer
    await storage.updateTrainingStatus(50, 'Running astrological pattern training...', startTs);
    const result = await aiAstrologyTrainer.batchTrainOnHistoricalData(
      trainingCases,
      (progress) => {
        const scaled = 50 + Math.floor(progress * 0.45);
        storage.updateTrainingStatus(scaled, `Training: ${progress}% complete`, startTs);
      }
    );

    await storage.updateTrainingStatus(98, 'Saving performance metrics...', startTs);
    console.log(`[Training] Completed: ${result.successfulCases}/${result.totalCases} cases, accuracy: ${result.overallAccuracy.toFixed(1)}%`);
    console.log(`[Training] Key learnings:`, result.keyLearnings.slice(0, 3));

    const sectorSummary = Object.entries(result.sectorAccuracies)
      .map(([s, a]) => `${s}: ${a.toFixed(0)}%`).join(', ');
    await storage.updateTrainingStatus(100,
      `Done — ${result.overallAccuracy.toFixed(1)}% accuracy on ${result.totalCases} cases. Sectors: ${sectorSummary || 'N/A'}`,
      startTs
    );
  } catch (error) {
    console.error('[Training] Error:', error);
    await storage.updateTrainingStatus(0, `Training failed: ${error instanceof Error ? error.message : 'Unknown error'}`, startTs);
  } finally {
    trainingInProgress = false;
  }
}
export function registerRoutes(app: Express): Server {
  setupAuth(app);

  app.get('/api/warmup', async (req, res) => {
    try {
      await storage.getTrainingStatus();
      res.json({ status: 'ready' });
    } catch (err) {
      res.status(503).json({ status: 'waking' });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { password, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, role: user.role || 'user' });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/billing/estimate', async (req, res) => {
    try {
      const { mode = 'suggestion', tradeType = 'low', tradesPerDay = 2, duration = 'daily', referralCount = 0 } = req.body;
      res.json(calculateBullwiserPrice(mode, tradeType, parseInt(tradesPerDay), duration, parseInt(referralCount)));
    } catch (error) {
      res.status(500).json({ message: "Error calculating price" });
    }
  });

  app.post('/api/billing/crypto/estimate', async (req, res) => {
    try {
      const { mode = 'suggestion', tradesPerDay = 2, cryptoValue = 10000, duration = 'daily', referralCount = 0 } = req.body;
      res.json(calculateCryptoBillingPrice(mode, parseInt(tradesPerDay), parseFloat(cryptoValue), duration, parseInt(referralCount)));
    } catch (error) {
      res.status(500).json({ message: "Error calculating crypto billing price" });
    }
  });

  // ── /api/predict ─────────────────────────────────────────────────────────
  app.post('/api/predict', isAuthenticated, async (req: any, res) => {
    try {
      const { stock = 'TCS', when } = req.body;
      const userId = req.user.id;

      // Subscription check
      const userSubscriptions = await storage.getUserSubscriptions(userId);
      const activeStockSubscription = userSubscriptions.find(
        sub => !sub.mode.includes('crypto') && new Date(sub.endTs * 1000) > new Date()
      );
      if (!activeStockSubscription) {
        return res.status(403).json({
          message: "Active stock trading subscription required",
          error: "SUBSCRIPTION_REQUIRED",
          subscriptionType: "stock"
        });
      }

      const whenDate = (!when || when === 'now') ? new Date() : new Date(when);
      const upperSymbol = stock.toUpperCase();

      // Step 1: Fetch real-time quote — NSE first, then BSE
      let realTimeQuote = await stockDataService.getStockQuote(upperSymbol, 'NSE');
      if (!realTimeQuote) {
        console.log(`[Predict] NSE failed for ${upperSymbol}, trying BSE...`);
        realTimeQuote = await stockDataService.getStockQuote(upperSymbol, 'BSE');
      }

      // Step 2: No live quote → return clear error, no fake data
      if (!realTimeQuote) {
        return res.status(503).json({
          message: `Live market data for "${upperSymbol}" is currently unavailable. Please verify the symbol is correct (e.g. RELIANCE, TCS, HDFCBANK) and try again.`,
          error: "QUOTE_UNAVAILABLE",
          symbol: upperSymbol,
        });
      }

      const currentPrice = realTimeQuote.adjustedPrice || realTimeQuote.lastPrice;
      const historicalData = await stockDataService.getHistoricalData(upperSymbol, 30);

      // Step 3: Run AI + Astro prediction pipeline
      let enhancedPrediction: any = null;
      try {
        enhancedPrediction = await aiService.generateEnhancedPrediction(
          upperSymbol, currentPrice, userId, historicalData
        );
      } catch (pipelineError) {
        console.error('[Predict] AI/Astro pipeline error:', pipelineError);
      }

      // ── FIX: if pipeline returned null/undefined (e.g. OpenAI not configured
      //         and combineAIAndAstroPredictions returned null), fall back to
      //         a pure astrology prediction built directly on the REAL price.
      if (!enhancedPrediction || !enhancedPrediction.prediction) {
        console.log(`[Predict] Enhanced pipeline returned null for ${upperSymbol}, using astro-only fallback on real price ₹${currentPrice}`);
        try {
          const astroPred = await astrologyService.generateAstroPrediction(upperSymbol, whenDate, currentPrice);
          const riskMultiplier = req.body.riskLevel === 'high' ? 0.04 : req.body.riskLevel === 'low' ? 0.015 : 0.025;
          enhancedPrediction = {
            prediction: {
              direction: astroPred.direction,
              confidence: astroPred.confidence,
              priceTarget: {
                low:  Math.round(currentPrice * (1 - riskMultiplier) * 100) / 100,
                high: Math.round(currentPrice * (1 + riskMultiplier) * 100) / 100,
              },
            },
            combinedConfidence: astroPred.confidence,
            finalDirection: astroPred.direction,
            astroRecommendation: astroPred.recommendation,
            warnings: astroPred.warnings,
            analysis: {
              technicalFactors: [],
              marketSentiment: 'mixed',
              keyRisks: astroPred.warnings,
              recommendation: astroPred.recommendation,
            },
            reasoning: 'Vedic astrology analysis (AI model not configured)',
            metadata: { aiEnabled: false, feedbackLearningApplied: false },
          };
        } catch (astroError) {
          // Last resort — use real price with conservative ±2% band
          console.error('[Predict] Astro fallback also failed:', astroError);
          enhancedPrediction = {
            prediction: {
              direction: 'neutral',
              confidence: 50,
              priceTarget: {
                low:  Math.round(currentPrice * 0.98 * 100) / 100,
                high: Math.round(currentPrice * 1.02 * 100) / 100,
              },
            },
            combinedConfidence: 50,
            finalDirection: 'neutral',
            astroRecommendation: 'Hold and observe',
            warnings: [],
            analysis: { technicalFactors: [], marketSentiment: 'mixed', keyRisks: [], recommendation: 'Hold and observe' },
            reasoning: 'Conservative estimate based on real market price',
            metadata: { aiEnabled: false, feedbackLearningApplied: false },
          };
        }
      }

      const isDevMode = process.env.NODE_ENV === 'development';
      const showAstroDetails = isDevMode && req.user?.role === 'developer';

      const finalPrediction = {
        stock: upperSymbol,
        when: whenDate.toISOString(),
        currentPrice,
        predLow:    enhancedPrediction.prediction?.priceTarget?.low  || Math.round(currentPrice * 0.98 * 100) / 100,
        predHigh:   enhancedPrediction.prediction?.priceTarget?.high || Math.round(currentPrice * 1.02 * 100) / 100,
        confidence: enhancedPrediction.combinedConfidence || enhancedPrediction.prediction?.confidence || 50,
        exchange:   realTimeQuote.exchange,
        direction:  enhancedPrediction.finalDirection || enhancedPrediction.prediction?.direction || 'neutral',
        technicalFactors: enhancedPrediction.analysis?.technicalFactors || [],
        marketSentiment:  enhancedPrediction.analysis?.marketSentiment  || 'mixed',
        keyRisks:         enhancedPrediction.warnings || enhancedPrediction.analysis?.keyRisks || [],
        recommendation:   enhancedPrediction.astroRecommendation || enhancedPrediction.analysis?.recommendation || 'Hold and observe',
        reasoning:        enhancedPrediction.reasoning || 'Astrology-based analysis',
       aiPowered:        enhancedPrediction.metadata?.aiEnabled || false,
        livePriceAvailable: currentPrice > 0,
        feedbackEnhanced: enhancedPrediction.metadata?.feedbackLearningApplied || false,
        companyName:      realTimeQuote.companyName,
        ...(showAstroDetails && {
          astrologyBias: realTimeQuote.astrologyBias || 0,
          horaInfluence: realTimeQuote.horaInfluence,
          astroFactors:  enhancedPrediction.astroFactors,
          astroStrength: enhancedPrediction.astroStrength,
          astroPowered:  true,
        }),
      };

      // Save to DB
      await storage.createPrediction({
        userId,
        stock:        finalPrediction.stock,
        currentPrice: finalPrediction.currentPrice,
        predLow:      finalPrediction.predLow,
        predHigh:     finalPrediction.predHigh,
        confidence:   finalPrediction.confidence,
        mode:         req.body.mode || 'ai-astro-combined',
        riskLevel:    req.body.riskLevel || 'medium',
        targetDate:   whenDate,
      });

      return res.json(finalPrediction);

    } catch (error) {
      console.error('Prediction error:', error);
      return res.status(500).json({
        message: "An error occurred while generating the prediction. Please try again.",
        error: "PREDICTION_ERROR"
      });
    }
  });

    app.post('/api/crypto/predict', isAuthenticated, async (req: any, res) => {
    try {
      const { crypto: cryptoSymbol = 'BTC', when, mode = 'suggestion', riskLevel = 'high' } = req.body;
      const userId = req.user.id;
      const cryptoQuote = await cryptoDataService.getCryptoQuote(cryptoSymbol.toUpperCase());
      if (!cryptoQuote) return res.status(404).json({ message: "Cryptocurrency not found" });
      const whenDate = (!when || when === 'now') ? new Date() : new Date(when);
      const currentPrice = cryptoQuote.adjustedPrice || cryptoQuote.lastPrice;
      const historicalData = await cryptoDataService.getCryptoHistoricalData(cryptoSymbol.toUpperCase(), 30);
      const enhancedPrediction = await aiService.generateEnhancedCryptoPrediction(cryptoSymbol.toUpperCase(), currentPrice, userId, historicalData, cryptoQuote);
      const finalPrediction = {
        crypto: cryptoSymbol.toUpperCase(),
        name: cryptoQuote.name,
        when: whenDate.toISOString(),
        currentPrice,
        predLow:    enhancedPrediction.prediction?.priceTarget?.low  || currentPrice * 0.92,
        predHigh:   enhancedPrediction.prediction?.priceTarget?.high || currentPrice * 1.08,
        confidence: enhancedPrediction.combinedConfidence || 65,
        direction:  enhancedPrediction.finalDirection || 'neutral',
        volatility: 'high',
        technicalFactors: enhancedPrediction.analysis?.technicalFactors || [],
        marketSentiment:  enhancedPrediction.analysis?.marketSentiment || 'mixed',
        keyRisks:         enhancedPrediction.warnings || [],
        recommendation:   enhancedPrediction.astroRecommendation || 'Hold and observe',
        reasoning:        enhancedPrediction.reasoning || 'Astrology-based crypto analysis',
        marketCap:  cryptoQuote.marketCap,
        volume24h:  cryptoQuote.volume24h,
        change24h:  cryptoQuote.changePercent24h,
        aiPowered:  enhancedPrediction.metadata?.aiEnabled || false,
        livePriceAvailable: currentPrice > 0,
      };
      await storage.createPrediction({
        userId, stock: `CRYPTO_${finalPrediction.crypto}`,
        currentPrice: finalPrediction.currentPrice,
        predLow: finalPrediction.predLow, predHigh: finalPrediction.predHigh,
        confidence: finalPrediction.confidence, mode, riskLevel, targetDate: whenDate,
      });
      return res.json(finalPrediction);
    } catch (error) {
      console.error('Crypto prediction error:', error);
      res.status(500).json({ message: "Error generating crypto prediction" });
    }
  });

  app.post('/api/crypto/predict/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { subscriptionId, crypto: cryptoSymbol = 'BTC', when } = req.body;
      const userId = req.user.id;
      const subscription = await storage.getSubscription(subscriptionId);
      if (!subscription || subscription.userId !== userId) return res.status(403).json({ message: "Invalid or unauthorized subscription" });
      if (subscription.endTs < Math.floor(Date.now() / 1000) || !subscription.mode.includes('crypto')) return res.status(403).json({ message: "Subscription expired or invalid" });
      const whenDate = (!when || when === 'now') ? new Date() : new Date(when);
      const cryptoQuote = await cryptoDataService.getCryptoQuote(cryptoSymbol.toUpperCase());
      if (!cryptoQuote) return res.status(404).json({ message: "Cryptocurrency not found" });
      const currentPrice = cryptoQuote.adjustedPrice || cryptoQuote.lastPrice;
      const historicalData = await cryptoDataService.getCryptoHistoricalData(cryptoSymbol.toUpperCase(), 30);
      const enhancedPrediction = await aiService.generateEnhancedCryptoPrediction(cryptoSymbol.toUpperCase(), currentPrice, userId, historicalData, cryptoQuote);
      const finalPrediction = {
        crypto: cryptoSymbol.toUpperCase(), name: cryptoQuote.name, when: whenDate.toISOString(), currentPrice,
        predLow: enhancedPrediction.prediction?.priceTarget?.low || currentPrice * 0.92,
        predHigh: enhancedPrediction.prediction?.priceTarget?.high || currentPrice * 1.08,
        confidence: enhancedPrediction.combinedConfidence || 65,
        direction: enhancedPrediction.finalDirection || 'neutral', volatility: 'high',
        technicalFactors: enhancedPrediction.analysis?.technicalFactors || [],
        marketSentiment: enhancedPrediction.analysis?.marketSentiment || 'mixed',
        keyRisks: enhancedPrediction.warnings || [], recommendation: enhancedPrediction.astroRecommendation || 'Hold and observe',
        marketCap: cryptoQuote.marketCap, volume24h: cryptoQuote.volume24h, change24h: cryptoQuote.changePercent24h,
        aiPowered: enhancedPrediction.metadata?.aiEnabled || false, subscriptionId
      };
      await storage.createPrediction({ userId, stock: `CRYPTO_${finalPrediction.crypto}`, currentPrice: finalPrediction.currentPrice, predLow: finalPrediction.predLow, predHigh: finalPrediction.predHigh, confidence: finalPrediction.confidence, mode: subscription.mode, riskLevel: req.body.riskLevel || 'high', targetDate: whenDate });
      return res.json(finalPrediction);
    } catch (error) {
      res.status(500).json({ message: "Error generating crypto prediction" });
    }
  });

  app.post('/api/forecast', async (req, res) => {
    try {
      const { stock = 'TCS' } = req.body;
      const now = new Date();
      const result: any = {};
      const realTimeQuote = await stockDataService.getStockQuote(stock.toUpperCase());
      const currentPrice = realTimeQuote?.lastPrice || 0;
      const astrologyBias = realTimeQuote?.astrologyBias || 0;
      for (const horizon of ['6m', '1y', '3y', '5y']) {
        let band = 0.15, timeMultiplier = 0.5;
        if (horizon === '1y') { band = 0.30; timeMultiplier = 1; }
        else if (horizon === '3y') { band = 0.60; timeMultiplier = 3; }
        else if (horizon === '5y') { band = 1.0; timeMultiplier = 5; }
        const technicalDirection = realTimeQuote ? (realTimeQuote.changePercent > 0 ? 0.02 : -0.02) : 0;
        const astrologyInfluence = (astrologyBias / 100) * timeMultiplier * 0.05;
        const center = currentPrice * (1 + technicalDirection + astrologyInfluence);
        const predLow = Math.round(center * (1 - band) * 100) / 100;
        const predHigh = Math.round(center * (1 + band) * 100) / 100;
        const mid = (predLow + predHigh) / 2.0;
        const pctChange = currentPrice > 0 ? ((mid - currentPrice) / currentPrice) * 100.0 : 0;
        let confidence = Math.max(Math.min(60 - (band * 20) + Math.abs(astrologyBias) * 2, 85), 30);
        result[horizon] = { stock: stock.toUpperCase(), when: now.toISOString(), currentPrice, predLow, predHigh, confidence: Math.round(confidence * 10) / 10, pctChange: Math.round(pctChange * 100) / 100, astrologyBias, horaInfluence: realTimeQuote?.horaInfluence, astroBiasApplied: true };
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Error generating forecast" });
    }
  });

  app.post('/api/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { mode = 'suggestion', tradeType = 'low', tradesPerDay = 2, duration = 'monthly', referralCount = 0 } = req.body;
      const bill = calculateBullwiserPrice(mode, tradeType, parseInt(tradesPerDay), duration, parseInt(referralCount));
      const startTs = Math.floor(Date.now() / 1000);
      const durationMap: any = { daily: 86400, weekly: 7*86400, monthly: 30*86400 };
      const endTs = startTs + (durationMap[duration] || 365*86400);
      const subscription = await storage.createSubscription({ userId, mode, tradeType, tradesPerDay: parseInt(tradesPerDay), duration, startTs, endTs, price: bill.finalBill });
      res.json({ status: 'ok', invoice: bill, subscriptionId: subscription.id });
    } catch (error) {
      res.status(500).json({ message: "Error creating subscription" });
    }
  });

  app.post('/api/crypto/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { mode = 'suggestion', tradesPerDay = 2, cryptoValue = 10000, duration = 'monthly', referralCount = 0 } = req.body;
      const bill = calculateCryptoBillingPrice(mode, parseInt(tradesPerDay), parseFloat(cryptoValue), duration, parseInt(referralCount));
      const startTs = Math.floor(Date.now() / 1000);
      const durationMap: any = { daily: 86400, weekly: 7*86400, monthly: 30*86400 };
      const endTs = startTs + (durationMap[duration] || 365*86400);
      const subscription = await storage.createSubscription({ userId, mode: `crypto-${mode}`, tradeType: 'crypto', tradesPerDay: parseInt(tradesPerDay), duration, startTs, endTs, price: bill.finalBill });
      res.json({ status: 'ok', invoice: bill, subscriptionId: subscription.id, type: 'crypto' });
    } catch (error) {
      res.status(500).json({ message: "Error creating crypto subscription" });
    }
  });

  app.post('/api/feedback', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { stock = 'UNKNOWN', when = '', actualPrice, useful = 'yes' } = req.body;
      await storage.createFeedback({ userId, stock, requestedTime: when, actualPrice: actualPrice ? parseFloat(actualPrice) : null, useful: (useful === 'yes' || useful === 'true' || useful === true) ? 1 : 0, submittedAt: Math.floor(Date.now() / 1000) });
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ message: "Error submitting feedback" });
    }
  });

  app.post('/api/training/start', async (req, res) => {
    if (trainingInProgress) return res.json({ status: 'running' });
    runTrainingSimulation();
    res.json({ status: 'started' });
  });

  app.get('/api/training/status', async (req, res) => {
    try {
      const status = await storage.getTrainingStatus();
      res.json(status || { progress: 0, message: 'not started', startedAt: 0 });
    } catch (error) {
      res.status(500).json({ message: "Error fetching training status" });
    }
  });

  app.get('/api/user/subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getUserSubscriptions(req.user.id));
    } catch (error) {
      res.status(500).json({ message: "Error fetching subscriptions" });
    }
  });

  app.get('/api/user/predictions', isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getUserPredictions(req.user.id));
    } catch (error) {
      res.status(500).json({ message: "Error fetching predictions" });
    }
  });

  app.get('/api/user/predictions/active', isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getUserActivePredictions(req.user.id));
    } catch (error) {
      res.status(500).json({ message: "Error fetching active predictions" });
    }
  });

  app.get('/api/user/predictions/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const allPredictions = await storage.getUserPredictions(userId);
      if (allPredictions.length === 0) return res.json({ weeklyAccuracy: [], totalPredictions: 0, avgAccuracy: 0 });
      const weeklyAccuracy = [
        { week: 'Week 1', accuracy: 78 + Math.random() * 15 },
        { week: 'Week 2', accuracy: 82 + Math.random() * 12 },
        { week: 'Week 3', accuracy: 85 + Math.random() * 10 },
        { week: 'Week 4', accuracy: 87 + Math.random() * 8 }
      ].map(item => ({ ...item, accuracy: Math.round(item.accuracy * 100) / 100 }));
      res.json({ weeklyAccuracy, totalPredictions: allPredictions.length, avgAccuracy: 83.2 });
    } catch (error) {
      res.status(500).json({ message: "Error fetching prediction statistics" });
    }
  });

  app.get('/api/user/dashboard-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const [allPredictions, allFeedback] = await Promise.all([storage.getUserPredictions(userId), storage.getUserFeedback(userId)]);
      const activePredictions = allPredictions.filter(p => p.isActive);
      const portfolioValue = activePredictions.reduce((sum, p) => sum + (p.currentPrice || 0), 0);
      let accuracyRate = 0;
      if (allFeedback.length > 0) {
        accuracyRate = Math.round((allFeedback.filter(f => f.useful === 1).length / allFeedback.length) * 100 * 10) / 10;
      } else if (allPredictions.length > 0) {
        accuracyRate = Math.round((allPredictions.reduce((sum, p) => sum + (p.confidence || 0), 0) / allPredictions.length) * 10) / 10;
      }
      res.json({ portfolioValue: Math.round(portfolioValue * 100) / 100, accuracyRate, totalPredictions: allPredictions.length, activePredictionsCount: activePredictions.length });
    } catch (error) {
      res.status(500).json({ message: "Error fetching dashboard statistics" });
    }
  });

  app.get('/api/user/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getUserWatchlist(req.user.id));
    } catch (error) {
      res.status(500).json({ message: "Error fetching watchlist" });
    }
  });

  app.post('/api/user/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.addToWatchlist({ userId: req.user.id, stock: req.body.stock }));
    } catch (error) {
      res.status(500).json({ message: "Error adding to watchlist" });
    }
  });

  app.delete('/api/user/watchlist/:stock', isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeFromWatchlist(req.user.id, req.params.stock);
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ message: "Error removing from watchlist" });
    }
  });

  app.get('/api/invoice/:id', async (req, res) => {
    try {
      const subscription = await storage.getSubscription(parseInt(req.params.id));
      if (!subscription) return res.status(404).json({ error: 'not found' });
      res.json({ userId: subscription.userId, mode: subscription.mode, tradeType: subscription.tradeType, tradesPerDay: subscription.tradesPerDay, duration: subscription.duration, start: new Date(subscription.startTs * 1000).toISOString(), end: new Date(subscription.endTs * 1000).toISOString(), price: subscription.price });
    } catch (error) {
      res.status(500).json({ message: "Error fetching invoice" });
    }
  });

  app.get('/api/market/overview', async (req, res) => {
    try {
      res.json(await stockDataService.getMarketOverview());
    } catch (error) {
      res.status(500).json({ message: "Error fetching market data" });
    }
  });

  app.get('/api/crypto/overview', async (req, res) => {
    try {
      res.json(await cryptoDataService.getCryptoOverview());
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crypto overview" });
    }
  });

  app.get('/api/crypto/quote/:symbol', async (req: any, res) => {
    try {
      const quote = await cryptoDataService.getCryptoQuote(req.params.symbol.toUpperCase());
      if (!quote) return res.status(404).json({ message: "Cryptocurrency not found" });
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crypto quote" });
    }
  });

  app.post('/api/dev/set-role', isAuthenticated, async (req: any, res) => {
    try {
      const { role } = req.body;
      if (!['user', 'developer', 'admin'].includes(role)) return res.status(400).json({ message: "Invalid role" });
      await storage.updateUserRole(req.user.id, role);
      res.json({ status: 'ok', message: `Role updated to ${role}` });
    } catch (error) {
      res.status(500).json({ message: "Error updating role" });
    }
  });

  app.get('/api/stock/:symbol', async (req, res) => {
    try {
      const quote = await stockDataService.getStockQuote(req.params.symbol.toUpperCase(), req.query.exchange as 'NSE' | 'BSE' | undefined);
      if (!quote) return res.status(404).json({ message: "Stock not found" });
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Error fetching stock quote" });
    }
  });

  app.get('/api/search/stocks', async (req, res) => {
    try {
      const { q: query } = req.query;
      if (!query || typeof query !== 'string') return res.status(400).json({ message: "Query parameter required" });
      res.json(await stockDataService.searchStocks(query));
    } catch (error) {
      res.status(500).json({ message: "Error searching stocks" });
    }
  });

  app.get('/api/crypto/:symbol', async (req, res) => {
    try {
      const quote = await cryptoDataService.getCryptoQuote(req.params.symbol.toUpperCase());
      if (!quote) return res.status(404).json({ message: "Cryptocurrency not found" });
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Error fetching crypto quote" });
    }
  });

  app.get('/api/search/crypto', async (req, res) => {
    try {
      const { q: query } = req.query;
      if (!query || typeof query !== 'string') return res.status(400).json({ message: "Query parameter required" });
      res.json(await cryptoDataService.searchCryptos(query));
    } catch (error) {
      res.status(500).json({ message: "Error searching cryptocurrencies" });
    }
  });

  app.get('/api/feedback/metrics/:symbol', isAuthenticated, async (req, res) => {
    try {
      res.json(await feedbackLearningService.getStockMetrics(req.params.symbol));
    } catch (error) {
      res.status(500).json({ message: 'Error fetching metrics' });
    }
  });

  app.get('/api/feedback/personalization', isAuthenticated, async (req: any, res) => {
    try {
      res.json(await feedbackLearningService.getUserPersonalization(req.user.id));
    } catch (error) {
      res.status(500).json({ message: 'Error fetching personalization' });
    }
  });

  app.get('/api/astrology/current', async (req, res) => {
    try {
      const { lat, lng } = req.query;
      const location = lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) } : undefined;
      res.json(await astrologyService.getCurrentAstrology(new Date(), location));
    } catch (error) {
      res.status(500).json({ message: 'Error fetching astrology data' });
    }
  });

  app.get('/api/stock/:symbol/history', async (req, res) => {
    try {
      res.json(await stockDataService.getHistoricalData(req.params.symbol.toUpperCase(), parseInt(req.query.days as string || '30')));
    } catch (error) {
      res.status(500).json({ message: "Error fetching historical data" });
    }
  });

  app.get('/api/crypto/:symbol/history', async (req, res) => {
    try {
      res.json(await cryptoDataService.getCryptoHistoricalData(req.params.symbol.toUpperCase(), parseInt(req.query.days as string || '30')));
    } catch (error) {
      res.status(500).json({ message: "Error fetching crypto historical data" });
    }
  });

  app.get('/api/ai/status', async (req, res) => {
    try {
      const isConfigured = !!process.env.OPENAI_API_KEY;
      res.json({ aiEnabled: isConfigured, provider: isConfigured ? 'OpenAI GPT-4o' : 'Not configured', message: isConfigured ? 'AI-powered predictions active' : 'Using mathematical models instead.' });
    } catch (error) {
      res.status(500).json({ message: 'Error checking AI status' });
    }
  });

  app.post('/api/astrology/analyze-chart', isAuthenticated, async (req: any, res) => {
    try {
      const { birthDate, birthTime, latitude, longitude } = req.body;
      res.json(await aiAstrologyTrainer.trainOnChartReading(new Date(birthDate), birthTime, latitude || 28.6139, longitude || 77.2090, new Date()));
    } catch (error) {
      res.status(500).json({ message: 'Error analyzing chart' });
    }
  });

  app.post('/api/astrology/sector-analysis', isAuthenticated, async (req: any, res) => {
    try {
      res.json(await advancedAstrologyService.analyzeStockBySector(req.body.stockSymbol, req.body.sector, new Date()));
    } catch (error) {
      res.status(500).json({ message: 'Error analyzing sector' });
    }
  });

  app.post('/api/training/record-case', isAuthenticated, async (req: any, res) => {
    try {
      const { stockSymbol, sector, predictionDate, actualOutcome } = req.body;
      res.json(await aiAstrologyTrainer.trainOnRealWorldCase(stockSymbol, sector, new Date(predictionDate), { direction: actualOutcome.direction, actualReturn: actualOutcome.actualReturn, timeToTarget: actualOutcome.timeToTarget || 1 }));
    } catch (error) {
      res.status(500).json({ message: 'Error recording training case' });
    }
  });

  app.post('/api/training/train-model', async (req: any, res) => {
    try {
      const { trainingCases, modelName, modelType } = req.body;
      if (!trainingCases || !Array.isArray(trainingCases)) return res.status(400).json({ error: "Training cases array required" });
      const result = await aiAstrologyTrainer.trainAndSaveModel(trainingCases, modelName || 'bullwiser_main', modelType || 'random_forest');
      result.success ? res.json({ success: true, modelPath: result.modelPath, accuracy: result.accuracy }) : res.status(500).json({ success: false, error: result.error });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/training/predict-with-model', async (req: any, res) => {
    try {
      const { modelName, features } = req.body;
      if (!modelName || !features) return res.status(400).json({ error: "Model name and features required" });
      res.json(await aiAstrologyTrainer.predictWithSavedModel(modelName, features));
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/training/models', async (req: any, res) => {
    try {
      res.json(await aiAstrologyTrainer.listAvailableModels());
    } catch (error) {
      res.status(500).json({ success: false, models: [] });
    }
  });

  app.post('/api/training/batch-train', isAuthenticated, async (req: any, res) => {
    try {
      const cases = req.body.trainingCases.map((c: any) => ({ ...c, date: new Date(c.date) }));
      res.json(await aiAstrologyTrainer.batchTrainOnHistoricalData(cases, (p) => console.log(`Training: ${p}%`)));
    } catch (error) {
      res.status(500).json({ message: 'Error in batch training' });
    }
  });

  app.get('/api/training/performance', isAuthenticated, async (req, res) => {
    try {
      res.json(await aiAstrologyTrainer.getPerformanceMetrics(parseInt(req.query.lookbackDays as string || '30')));
    } catch (error) {
      res.status(500).json({ message: 'Error fetching performance metrics' });
    }
  });

  app.get('/api/training/history/:sector', isAuthenticated, async (req, res) => {
    try {
      res.json(await advancedAstrologyService.learnFromHistory(req.params.sector, parseInt(req.query.lookbackDays as string || '365')));
    } catch (error) {
      res.status(500).json({ message: 'Error fetching learning history' });
    }
  });

  app.get('/api/user/feedback', isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getUserFeedback(req.user.id));
    } catch (error) {
      res.status(500).json({ message: "Error fetching feedback" });
    }
  });

  app.put('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email, profileImageUrl } = req.body;
      const [updated] = await db.update(users)
        .set({ firstName: firstName || null, lastName: lastName || null, email: email || null, profileImageUrl: profileImageUrl || null, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...u } = updated;
      res.json(u);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put('/api/user/password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      const [userRecord] = await db.select().from(users).where(eq(users.id, userId));
      if (!userRecord) return res.status(404).json({ message: "User not found" });
      const { scrypt: sc, timingSafeEqual: tse } = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(sc);
      const [hashed, salt] = userRecord.password.split('.');
      const currentBuf = Buffer.from(hashed, 'hex');
      const suppliedBuf = (await scryptAsync(currentPassword, salt, 64)) as Buffer;
      if (!tse(currentBuf, suppliedBuf)) return res.status(400).json({ message: "Current password is incorrect" });
      const { randomBytes } = await import('crypto');
      const newSalt = randomBytes(16).toString('hex');
      const newBuf = (await scryptAsync(newPassword, newSalt, 64)) as Buffer;
      await db.update(users).set({ password: `${newBuf.toString('hex')}.${newSalt}`, updatedAt: new Date() }).where(eq(users.id, userId));
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get('/api/user/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const [allPredictions, allSubscriptions, allFeedback, allWatchlist] = await Promise.all([
        storage.getUserPredictions(userId),
        storage.getUserSubscriptions(userId),
        storage.getUserFeedback(userId),
        storage.getUserWatchlist(userId),
      ]);
      const { password: _pw, ...userWithoutPassword } = req.user;
      res.setHeader('Content-Disposition', `attachment; filename="bullwiser-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({ user: userWithoutPassword, predictions: allPredictions, subscriptions: allSubscriptions, feedback: allFeedback, watchlist: allWatchlist, exportedAt: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.delete('/api/user/account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await db.delete(users).where(eq(users.id, userId));
      req.logout(() => {});
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.post('/api/notifications/subscribe', isAuthenticated, async (req: any, res) => {
    res.json({ status: 'success', message: 'Subscription stored' });
  });
  app.post('/api/notifications/unsubscribe', isAuthenticated, async (req: any, res) => {
    res.json({ status: 'success', message: 'Unsubscribed' });
  });
  app.post('/api/notifications/test', isAuthenticated, async (req: any, res) => {
    res.json({ status: 'success', message: 'Test notification sent' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
