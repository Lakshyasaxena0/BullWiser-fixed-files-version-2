// ══════════════════════════════════════════════════════════════════════════════
// ADD THESE LINES TO server/routes.ts
// ══════════════════════════════════════════════════════════════════════════════

// 1. ADD THIS IMPORT at the top (around line 13, after other service imports):
import { predictionHistoryService } from "./predictionHistoryService";

// 2. ADD THESE ENDPOINTS anywhere after the existing endpoints (around line 300+):

// ── Prediction Analytics Routes ──────────────────────────────────────────────
  
  // Get prediction history with analytics
  app.get('/api/predictions/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string || '100');
      const history = await predictionHistoryService.getUserPredictionHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error('[API] Error fetching prediction history:', error);
      res.status(500).json({ message: 'Error fetching prediction history' });
    }
  });

  // Get prediction statistics
  app.get('/api/predictions/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await predictionHistoryService.getUserPredictionStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('[API] Error fetching prediction stats:', error);
      res.status(500).json({ message: 'Error fetching prediction stats' });
    }
  });

  // Get single prediction details
  app.get('/api/predictions/:id/details', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const predictionId = parseInt(req.params.id);
      const details = await predictionHistoryService.getPredictionDetails(predictionId, userId);
      
      if (!details) {
        return res.status(404).json({ message: 'Prediction not found' });
      }
      
      res.json(details);
    } catch (error) {
      console.error('[API] Error fetching prediction details:', error);
      res.status(500).json({ message: 'Error fetching prediction details' });
    }
  });

// ══════════════════════════════════════════════════════════════════════════════
// 3. UPDATE THE PREDICTION CREATION CODE
// ══════════════════════════════════════════════════════════════════════════════

// FIND this line in the /api/predict endpoint (around line 180):
// await storage.createPrediction({ userId, stock: finalPrediction.stock, ...

// REPLACE IT WITH THIS (to store reasoning data):

      // Build statistical reasoning from technical factors
      const statisticalReasoning = enhancedPrediction.analysis?.technicalFactors?.length > 0
        ? enhancedPrediction.analysis.technicalFactors.join('; ')
        : 'Standard technical analysis applied';

      // Build astro reasoning
      const astroReasoning = enhancedPrediction.astroRecommendation || 
        (enhancedPrediction.warnings?.length > 0 ? enhancedPrediction.warnings.join('; ') : null);

      // Build planetary data (if available from astrology service)
      let planetaryData: any = null;
      try {
        const astroData = await astrologyService.getCurrentAstrology(whenDate);
        planetaryData = {
          sun: astroData.planetaryPositions?.sun || null,
          moon: astroData.planetaryPositions?.moon || null,
          mercury: astroData.planetaryPositions?.mercury || null,
          venus: astroData.planetaryPositions?.venus || null,
          mars: astroData.planetaryPositions?.mars || null,
          jupiter: astroData.planetaryPositions?.jupiter || null,
          saturn: astroData.planetaryPositions?.saturn || null,
          hora: astroData.horaLord || null,
          nakshatra: astroData.currentNakshatra || null,
        };
      } catch (astroError) {
        console.log('[Predict] Could not fetch planetary data:', astroError);
      }

      // Create prediction with analytics data
      await storage.createPrediction({
        userId,
        stock: finalPrediction.stock,
        currentPrice: finalPrediction.currentPrice,
        predLow: finalPrediction.predLow,
        predHigh: finalPrediction.predHigh,
        confidence: finalPrediction.confidence,
        mode: req.body.mode || 'ai-astro-combined',
        riskLevel: req.body.riskLevel || 'medium',
        targetDate: whenDate,
        statisticalReasoning,
        astroReasoning,
        planetaryData: planetaryData ? JSON.stringify(planetaryData) : null,
      });

// ══════════════════════════════════════════════════════════════════════════════
// 4. SIMILAR UPDATE FOR /api/crypto/predict endpoint
// ══════════════════════════════════════════════════════════════════════════════

// FIND the storage.createPrediction call in /api/crypto/predict (around line 230)
// ADD the same fields: statisticalReasoning, astroReasoning, planetaryData

      // Build statistical reasoning from technical factors
      const cryptoStatisticalReasoning = enhancedPrediction.analysis?.technicalFactors?.length > 0
        ? enhancedPrediction.analysis.technicalFactors.join('; ')
        : 'Crypto technical analysis with volatility adjustment';

      // Build astro reasoning
      const cryptoAstroReasoning = enhancedPrediction.astroRecommendation || null;

      // Get planetary data
      let cryptoPlanetaryData: any = null;
      try {
        const astroData = await astrologyService.getCurrentAstrology(whenDate);
        cryptoPlanetaryData = {
          sun: astroData.planetaryPositions?.sun || null,
          moon: astroData.planetaryPositions?.moon || null,
          mercury: astroData.planetaryPositions?.mercury || null,
          venus: astroData.planetaryPositions?.venus || null,
          mars: astroData.planetaryPositions?.mars || null,
          jupiter: astroData.planetaryPositions?.jupiter || null,
          saturn: astroData.planetaryPositions?.saturn || null,
          hora: astroData.horaLord || null,
          nakshatra: astroData.currentNakshatra || null,
        };
      } catch (astroError) {
        console.log('[CryptoPredict] Could not fetch planetary data:', astroError);
      }

      await storage.createPrediction({
        userId,
        stock: `CRYPTO_${finalPrediction.crypto}`,
        currentPrice: finalPrediction.currentPrice,
        predLow: finalPrediction.predLow,
        predHigh: finalPrediction.predHigh,
        confidence: finalPrediction.confidence,
        mode,
        riskLevel,
        targetDate: whenDate,
        statisticalReasoning: cryptoStatisticalReasoning,
        astroReasoning: cryptoAstroReasoning,
        planetaryData: cryptoPlanetaryData ? JSON.stringify(cryptoPlanetaryData) : null,
      });

// ══════════════════════════════════════════════════════════════════════════════
// END OF ROUTES.TS UPDATES
// ══════════════════════════════════════════════════════════════════════════════
