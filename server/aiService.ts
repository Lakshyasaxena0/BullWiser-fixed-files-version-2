// =============================================================================
// PATCH FILE — aiService.ts
// Apply these 3 changes in order. Nothing else in aiService.ts changes.
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// CHANGE 1 of 3 — Add import at the top of the file
// Location: after the last existing import line (after advancedAstrologyService)
// =============================================================================

// ADD this line:
import { statisticalAnalysisService } from './statisticalAnalysisService';


// ─────────────────────────────────────────────────────────────────────────────
// CHANGE 2 of 3 — Add Step 2.5 inside generateEnhancedPrediction()
// Location: in the try{} block, AFTER Step 2 (aiPrediction) and BEFORE Step 3
// =============================================================================

// EXISTING code (Step 2 ends here, Step 3 starts here — insert between them):
//
//   }                                               ← closing brace of Step 2 if-block
//                                                   ← INSERT HERE
//   // Step 3: Basic Vedic astrology
//   const astroPrediction = await astrologyService...
//
// INSERT the following block:

      // ── Step 2.5: Statistical analysis ──────────────────────────────────────
      // Fetches 200-day OHLCV from Yahoo Finance and computes RSI, MACD,
      // Bollinger Bands, SMAs, ATR, OBV, Support/Resistance, EMA crossover.
      let statAnalysis: Awaited<ReturnType<typeof statisticalAnalysisService.analyze>> | null = null;
      try {
        const isCrypto = false; // stocks path — crypto path handled separately
        statAnalysis = await statisticalAnalysisService.analyze(symbol, isCrypto);
        console.log(
          `[StatSvc] ${symbol}: score=${statAnalysis.statisticalScore}, ` +
          `dir=${statAnalysis.direction}, candles=${statAnalysis.candlesUsed}, ` +
          `source=${statAnalysis.dataSource}`
        );
      } catch (statErr) {
        console.error('[StatSvc] Statistical analysis error (non-fatal):', statErr);
      }


// ─────────────────────────────────────────────────────────────────────────────
// CHANGE 3 of 3 — Replace Step 6 (advanced astro adjustments) with the
// new 50/50 blend + advanced astro on top.
// Location: replaces the entire "// Step 6: Apply advanced astrology adjustments"
// block, right after combinedPrediction is first set in Step 5.
// =============================================================================

// REMOVE (the existing Step 6 block — starting at the comment and ending at the
// closing brace before "// Step 7"):
//
//   // Step 6: Apply advanced astrology adjustments
//   if (advancedAstroResult) {
//     ...
//     combinedPrediction.advancedAstro = { ... };
//   }
//
// REPLACE with:

      // ── Step 6: 50/50 Statistical + Astro blend ─────────────────────────────
      if (statAnalysis) {
        // astroScore lives in astroPrediction.strength (0–100 composite)
        const astroScore    = astroPrediction.strength ?? 50;
        const astroDir      = astroPrediction.direction ?? 'neutral';

        const blendResult = statisticalAnalysisService.blendWithAstro(
          statAnalysis, astroScore, astroDir
        );

        // Override direction and confidence with blended values
        combinedPrediction.finalDirection      = blendResult.finalDirection;
        combinedPrediction.combinedConfidence  = blendResult.finalConfidence;

        // Attach statistical data for the frontend / API response
        combinedPrediction.statisticalAnalysis = {
          score:        blendResult.statisticalScore,
          direction:    statAnalysis.direction,
          confidence:   statAnalysis.confidence,
          keyFindings:  statAnalysis.keyFindings,
          warnings:     statAnalysis.warnings,
          candlesUsed:  statAnalysis.candlesUsed,
          dataSource:   statAnalysis.dataSource,
          indicators: {
            rsi14:    statAnalysis.indicators.rsi14.value,
            macd:     statAnalysis.indicators.macd.value,
            sma20pct: statAnalysis.indicators.sma20.value,
            sma50pct: statAnalysis.indicators.sma50.value,
            sma200pct:statAnalysis.indicators.sma200.value,
            atrPct:   statAnalysis.indicators.atr14.value,
            pctB:     statAnalysis.indicators.bollingerBand.value,
            obvTrend: statAnalysis.indicators.obv.value,
          },
        };

        combinedPrediction.blendInfo = {
          statsWeight:     0.50,
          astroWeight:     0.50,
          conflicting:     blendResult.conflicting,
          blendNote:       blendResult.blendNote,
          statScore:       blendResult.statisticalScore,
          astroScore:      blendResult.astroScore,
        };

        // Add statistical key findings to technicalFactors
        if (!combinedPrediction.analysis) {
          combinedPrediction.analysis = { technicalFactors: [], marketSentiment: 'mixed', keyRisks: [], recommendation: '' };
        }
        combinedPrediction.analysis.technicalFactors = [
          ...(combinedPrediction.analysis.technicalFactors || []),
          ...statAnalysis.keyFindings.slice(0, 3),
        ].slice(0, 8);

        combinedPrediction.analysis.keyRisks = [
          ...(combinedPrediction.analysis.keyRisks || []),
          ...statAnalysis.warnings,
        ];

        if (blendResult.conflicting) {
          combinedPrediction.warnings = [
            ...(combinedPrediction.warnings || []),
            `⚠️ Statistical & astrology signals conflict — ${blendResult.blendNote}`,
          ];
        }

        console.log(
          `[Blend] ${symbol}: stat=${blendResult.statisticalScore} (${statAnalysis.direction}), ` +
          `astro=${blendResult.astroScore} (${astroDir}), ` +
          `final=${blendResult.finalDirection} conf=${blendResult.finalConfidence}% ` +
          `${blendResult.conflicting ? '⚡CONFLICT' : '✅AGREE'}`
        );
      }

      // ── Step 6b: Advanced astrology adjustments (on top of blend) ───────────
      // These fine-tune the already-blended confidence rather than overriding direction.
      if (advancedAstroResult) {
        const sectorStrength  = advancedAstroResult.sectorStrength || 50;
        const sectorBias      = (sectorStrength - 50) / 50;
        // Reduced influence since we now share 50% with stats (was ±12, now ±6)
        const sectorConfBoost = Math.round(sectorBias * 6);

        if (combinedPrediction.combinedConfidence !== undefined) {
          combinedPrediction.combinedConfidence = Math.min(95, Math.max(30,
            combinedPrediction.combinedConfidence + sectorConfBoost + yogaBonus + transitImpact
          ));
        }

        // Direction guard: only flip neutral→directional, never override the
        // stats-wins tiebreak that already ran above.
        const timing = advancedAstroResult.timing;
        if (timing === 'excellent' && combinedPrediction.finalDirection === 'neutral') {
          combinedPrediction.finalDirection = 'bullish';
        }
        if (timing === 'challenging' && combinedPrediction.finalDirection === 'neutral') {
          combinedPrediction.finalDirection = 'bearish';
        }

        const sectorFactors = (advancedAstroResult.keyFactors || []).slice(0, 3)
          .map((f: string) => `[${sector} sector] ${f}`);

        combinedPrediction.analysis.technicalFactors = [
          ...(combinedPrediction.analysis.technicalFactors || []),
          ...sectorFactors,
        ].slice(0, 8);

        if (yogaBonus > 10) {
          combinedPrediction.analysis.technicalFactors.push(
            'D-10 Dashamsa: Strong Raj/Dhana yoga — supports upward momentum'
          );
        } else if (yogaBonus < -10) {
          combinedPrediction.analysis.keyRisks = [
            ...(combinedPrediction.analysis.keyRisks || []),
            'D-10 Dashamsa: Arishta yoga active — increased downside risk',
          ];
        }

        if (transitImpact > 8) {
          combinedPrediction.analysis.technicalFactors.push(
            `Planetary transits: ${Math.round(transitImpact / 3)} benefic influences active`
          );
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

// ─────────────────────────────────────────────────────────────────────────────
// CRYPTO PATCH — generateEnhancedCryptoPrediction()
// Location: inside the try{} block, AFTER stateful astro lines, BEFORE
// the return statement. Replace the existing combinedPrediction line.
// =============================================================================

// ADD after `const combinedPrediction = this.combineCryptoPredictions(...)`:

      // Statistical analysis for crypto
      let cryptoStatAnalysis: Awaited<ReturnType<typeof statisticalAnalysisService.analyze>> | null = null;
      try {
        cryptoStatAnalysis = await statisticalAnalysisService.analyze(cryptoSymbol, true);
        console.log(
          `[StatSvc/Crypto] ${cryptoSymbol}: score=${cryptoStatAnalysis.statisticalScore}, ` +
          `dir=${cryptoStatAnalysis.direction}, candles=${cryptoStatAnalysis.candlesUsed}`
        );
      } catch (statErr) {
        console.error('[StatSvc/Crypto] Statistical analysis error (non-fatal):', statErr);
      }

      // 50/50 blend for crypto
      if (cryptoStatAnalysis) {
        const astroScoreCrypto = astroStrength ?? 50;
        const cryptoBlend = statisticalAnalysisService.blendWithAstro(
          cryptoStatAnalysis, astroScoreCrypto, combinedPrediction.finalDirection || 'neutral'
        );
        combinedPrediction.finalDirection  = cryptoBlend.finalDirection;
        combinedPrediction.confidence      = cryptoBlend.finalConfidence;
        combinedPrediction.combinedConfidence = cryptoBlend.finalConfidence;
        combinedPrediction.statisticalAnalysis = {
          score:       cryptoBlend.statisticalScore,
          direction:   cryptoStatAnalysis.direction,
          confidence:  cryptoStatAnalysis.confidence,
          keyFindings: cryptoStatAnalysis.keyFindings,
          warnings:    cryptoStatAnalysis.warnings,
          candlesUsed: cryptoStatAnalysis.candlesUsed,
          dataSource:  cryptoStatAnalysis.dataSource,
        };
        combinedPrediction.blendInfo = {
          statsWeight: 0.50, astroWeight: 0.50,
          conflicting: cryptoBlend.conflicting,
          blendNote:   cryptoBlend.blendNote,
          statScore:   cryptoBlend.statisticalScore,
          astroScore:  cryptoBlend.astroScore,
        };
      }

// =============================================================================
// END OF PATCH
// =============================================================================
//
// ALSO update metadata.sources in Step 9 to add:
//   statistics: statAnalysis
//     ? `Yahoo Finance 200-day OHLCV — RSI, MACD, BB, SMA20/50/200, ATR, OBV`
//     : 'Not available',
//
// And add to the metadata object:
//   statisticsEnabled: !!statAnalysis,
//
// =============================================================================
