import { GoogleGenerativeAI } from "@google/generative-ai";
import { advancedAstrologyService } from './advancedAstrologyService';
import { db } from './db';
import { trainingData } from '@shared/schema';
import { desc } from 'drizzle-orm';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';

// Gemini Pro for deeper astrological chart analysis
const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY || '');
const geminiPro = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

async function geminiJSON(systemPrompt: string, userPrompt: string): Promise<any> {
  const full = `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences.\n\n${userPrompt}`;
  const result = await geminiPro.generateContent(full);
  const text = result.response.text().trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  return JSON.parse(text);
}

interface ChartAnalysis {
  d1Analysis: string;
  d9Analysis: string;
  d10Analysis: string;
  transitAnalysis: string;
  dashaAnalysis: string;
  horaAnalysis: string;
  combinedInsight: string;
  confidence: number;
}

interface StockPrediction {
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  timeFrame: string;
  reasoning: string;
}

export class AIAstrologyTrainer {

  async trainOnChartReading(
    birthDate: Date,
    birthTime: string,
    latitude: number,
    longitude: number,
    currentDate: Date = new Date()
  ): Promise<ChartAnalysis> {
    const d1Chart    = advancedAstrologyService.generateD1Chart(birthDate, birthTime, latitude, longitude);
    const d9Chart    = advancedAstrologyService.generateD9Chart(d1Chart);
    const d10Chart   = advancedAstrologyService.generateD10Chart(d1Chart);
    const transits   = advancedAstrologyService.calculateTransits(d1Chart, currentDate);
    const moonNakshatra = d1Chart.planets.find((p: any) => p.planet === 'Moon')?.nakshatra || 'Ashwini';
    const dashaSystem   = advancedAstrologyService.calculateDasha(moonNakshatra, birthDate, currentDate);
    const currentTime   = currentDate.toTimeString().split(' ')[0];
    const horaSystem    = advancedAstrologyService.calculateHoraSystem(currentDate, currentTime);
    const chartContext  = this.prepareChartContext(d1Chart, d9Chart, d10Chart, transits, dashaSystem, horaSystem);

    try {
      const analysis = await geminiJSON(
        `You are an expert Vedic astrologer specializing in financial astrology for the Indian stock market.
        Analyze the provided astrological charts and provide detailed, actionable insights for stock market predictions.
        Focus on:
        - Wealth houses (2nd, 5th, 9th, 11th) and their lords
        - Career house (10th) for professional and financial direction
        - Planetary periods (Mahadasha/Antardasha) and their financial implications
        - Current planetary transits affecting wealth and career
        - Hora system for short-term trading timing
        - Yogas formed (Raj Yoga, Dhana Yoga, Arishta Yoga) and their strength
        Provide specific, actionable insights. Be precise and quantitative where possible.`,
        chartContext
      );

      return {
        d1Analysis:      analysis.d1Analysis      || 'Birth chart shows mixed planetary influences on wealth',
        d9Analysis:      analysis.d9Analysis      || 'Navamsa reveals underlying spiritual and material wealth patterns',
        d10Analysis:     analysis.d10Analysis     || 'Career chart indicates professional and financial direction',
        transitAnalysis: analysis.transitAnalysis || 'Current transits show neutral to slightly positive influence',
        dashaAnalysis:   analysis.dashaAnalysis   || 'Current planetary period suggests measured approach',
        horaAnalysis:    analysis.horaAnalysis    || 'Current hora indicates moderate trading conditions',
        combinedInsight: analysis.combinedInsight || 'Combined chart analysis suggests balanced market outlook',
        confidence:      typeof analysis.confidence === 'number' ? Math.min(95, Math.max(30, analysis.confidence)) : 55,
      };
    } catch (error) {
      console.error('Gemini chart analysis error:', error);
      return this.performRuleBasedAnalysis(d1Chart, d9Chart, d10Chart, transits, dashaSystem, horaSystem);
    }
  }

  async predictStockWithAstrology(
    stockSymbol: string,
    sector: string,
    currentPrice: number,
    historicalData: any[]
  ): Promise<StockPrediction> {
    const currentDate   = new Date();
    const sectorAnalysis = await advancedAstrologyService.analyzeStockBySector(stockSymbol, sector, currentDate);

    const predictionContext = {
      stock:            stockSymbol,
      sector:           sector,
      currentPrice:     currentPrice,
      recentPrices:     historicalData.slice(-10),
      sectorStrength:   sectorAnalysis.sectorStrength,
      planetarySupport: sectorAnalysis.planetarySupport,
      timing:           sectorAnalysis.timing,
      keyFactors:       sectorAnalysis.keyFactors,
      recommendation:   sectorAnalysis.recommendation,
    };

    try {
      const prediction = await geminiJSON(
        `You are a financial analyst with deep expertise in combining technical analysis with Vedic astrological insights for Indian equities.
        Given the planetary alignments and sector-specific astrological factors, provide precise trading predictions.
        Key rules:
        - Astrological factors carry 60% weight; technical analysis carries 40% weight
        - When astrology and technicals disagree, astrology takes precedence
        - For "excellent" timing: set targetPrice 5-10% above entry, stopLoss 3% below
        - For "good" timing: set targetPrice 3-5% above entry, stopLoss 2.5% below
        - For "neutral" timing: set targetPrice 2% above entry, stopLoss 2% below
        - For "challenging" timing: direction should be bearish, stopLoss tight
        - Be specific with actual price levels based on the currentPrice provided
        Provide JSON with keys: direction (bullish/bearish/neutral), confidence (30-90), entryPrice, targetPrice, stopLoss, timeFrame, reasoning.`,
        JSON.stringify(predictionContext)
      );

      const astroConfidence = sectorAnalysis.sectorStrength;
      const aiConfidence    = prediction.confidence || 50;
      const finalConfidence = (astroConfidence * 0.6) + (aiConfidence * 0.4);

      return {
        direction:   this.determineDirection(sectorAnalysis.timing, prediction.direction),
        confidence:  Math.round(finalConfidence),
        entryPrice:  prediction.entryPrice  || currentPrice,
        targetPrice: prediction.targetPrice || this.calculateTarget(currentPrice, sectorAnalysis.timing),
        stopLoss:    prediction.stopLoss    || this.calculateStopLoss(currentPrice, sectorAnalysis.timing),
        timeFrame:   prediction.timeFrame   || this.getTimeFrame(sectorAnalysis.timing),
        reasoning:   this.combineReasoning(sectorAnalysis, prediction),
      };
    } catch (error) {
      console.error('Gemini stock prediction error:', error);
      return this.createAstrologicalPrediction(stockSymbol, currentPrice, sectorAnalysis);
    }
  }

  async trainOnRealWorldCase(
    stockSymbol: string,
    sector: string,
    predictionDate: Date,
    actualOutcome: {
      direction: 'bullish' | 'bearish' | 'neutral';
      actualReturn: number;
      timeToTarget: number;
    }
  ): Promise<{ success: boolean; learnings: string[] }> {
    try {
      const planetaryConfig = await this.getPlanetaryConfiguration(predictionDate);
      const dashaConfig     = await this.getDashaConfiguration(predictionDate);
      const transitConfig   = await this.getTransitConfiguration(predictionDate);

      const prediction = await this.predictStockWithAstrology(stockSymbol, sector, 100, []);
      const accuracy   = prediction.direction === actualOutcome.direction ? 100 : 0;

      await advancedAstrologyService.recordTrainingData(
        stockSymbol, predictionDate, prediction.direction,
        actualOutcome.direction, planetaryConfig, dashaConfig,
        transitConfig, actualOutcome.actualReturn
      );

      const learnings = await this.extractLearnings(
        stockSymbol, sector, prediction, actualOutcome, planetaryConfig
      );
      await this.updateModelWithLearnings(learnings, sector);

      return { success: true, learnings };
    } catch (error) {
      console.error('Training error:', error);
      return { success: false, learnings: ['Failed to process training case'] };
    }
  }

  async batchTrainOnHistoricalData(
    trainingCases: Array<{
      stockSymbol: string;
      sector: string;
      date: Date;
      actualDirection: 'bullish' | 'bearish' | 'neutral';
      actualReturn: number;
    }>,
    progressCallback?: (progress: number) => void
  ): Promise<{
    totalCases: number;
    successfulCases: number;
    overallAccuracy: number;
    sectorAccuracies: Record<string, number>;
    keyLearnings: string[];
  }> {
    let successfulCases = 0;
    const sectorAccuracies: Record<string, number[]> = {};
    const allLearnings: string[] = [];

    for (let i = 0; i < trainingCases.length; i++) {
      const tc = trainingCases[i];
      const result = await this.trainOnRealWorldCase(tc.stockSymbol, tc.sector, tc.date, {
        direction: tc.actualDirection, actualReturn: tc.actualReturn, timeToTarget: 1,
      });

      if (result.success) {
        successfulCases++;
        allLearnings.push(...result.learnings);
        if (!sectorAccuracies[tc.sector]) sectorAccuracies[tc.sector] = [];
        sectorAccuracies[tc.sector].push(100);
      }

      if (progressCallback) progressCallback(Math.round((i + 1) / trainingCases.length * 100));
    }

    const avgSectorAccuracies: Record<string, number> = {};
    for (const [sector, accuracies] of Object.entries(sectorAccuracies)) {
      avgSectorAccuracies[sector] = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    }

    return {
      totalCases:       trainingCases.length,
      successfulCases,
      overallAccuracy:  (successfulCases / trainingCases.length) * 100,
      sectorAccuracies: avgSectorAccuracies,
      keyLearnings:     this.summarizeLearnings(allLearnings),
    };
  }

  async trainAndSaveModel(
    trainingCases: Array<{
      stockSymbol: string; sector: string; date: Date;
      actualDirection: 'bullish' | 'bearish' | 'neutral';
      actualReturn: number; features: number[]; astrologicalFactors: any;
    }>,
    modelName: string = 'bullwiser_main',
    modelType: string = 'random_forest'
  ): Promise<{ success: boolean; modelPath?: string; accuracy?: number; error?: string }> {
    try {
      console.log(`🤖 Training ${modelType} model with ${trainingCases.length} cases`);

      const features = trainingCases.map(c => c.features);
      const targets  = trainingCases.map(c => ({ bearish: 0, neutral: 1, bullish: 2 }[c.actualDirection]));

      const td = {
        features, targets,
        metadata: {
          model_name: modelName, model_type: modelType, astrology_enabled: true,
          sector_focus: [...new Set(trainingCases.map(c => c.sector))],
          training_period: `${trainingCases[0]?.date} to ${trainingCases[trainingCases.length - 1]?.date}`,
          total_samples: trainingCases.length, feature_count: features[0]?.length || 0,
        },
      };

      const tempFile = path.join(process.cwd(), 'temp_training_data.json');
      writeFileSync(tempFile, JSON.stringify(td, null, 2));

      const result = await this.executePythonTraining(tempFile);

      if (result.success) {
        console.log(`✅ Model ${modelName} trained with ${result.test_accuracy}% accuracy`);
        await this.recordModelTraining({
          modelName, modelType, accuracy: result.test_accuracy,
          modelPath: result.model_path, trainingCases: trainingCases.length,
          sectors: [...new Set(trainingCases.map(c => c.sector))],
        });
        return { success: true, modelPath: result.model_path, accuracy: result.test_accuracy };
      }
      return { success: false, error: result.error || 'Training failed' };
    } catch (error) {
      console.error('Model training error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private executePythonTraining(dataFile: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'python_modules', 'training_bridge.py');
      const proc = spawn('python', [scriptPath, 'train', dataFile]);
      let stdout = '', stderr = '';
      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); }
          catch (e) { reject(new Error(`Failed to parse training result: ${e}`)); }
        } else {
          reject(new Error(`Python training failed: ${stderr}`));
        }
      });
      proc.on('error', reject);
    });
  }

  async predictWithSavedModel(modelName: string, features: number[]): Promise<{
    success: boolean;
    prediction?: { direction: 'bullish' | 'bearish' | 'neutral'; confidence: number };
    error?: string;
  }> {
    try {
      const scriptPath = path.join(process.cwd(), 'python_modules', 'training_bridge.py');
      return await new Promise((resolve, reject) => {
        const proc = spawn('python', [scriptPath, 'predict', modelName, JSON.stringify(features)]);
        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
          if (code === 0) {
            try { resolve(JSON.parse(stdout)); }
            catch (e) { reject(new Error(`Failed to parse prediction result: ${e}`)); }
          } else {
            reject(new Error(`Python prediction failed: ${stderr}`));
          }
        });
        proc.on('error', reject);
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Prediction failed' };
    }
  }

  async listAvailableModels(): Promise<{ success: boolean; models: any[]; error?: string }> {
    try {
      const scriptPath = path.join(process.cwd(), 'python_modules', 'training_bridge.py');
      return await new Promise((resolve, reject) => {
        const proc = spawn('python', [scriptPath, 'list']);
        let stdout = '', stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
          if (code === 0) {
            try { resolve(JSON.parse(stdout)); }
            catch (e) { reject(new Error(`Failed to parse model list: ${e}`)); }
          } else {
            reject(new Error(`Python list failed: ${stderr}`));
          }
        });
        proc.on('error', reject);
      });
    } catch (error) {
      return { success: false, models: [], error: error instanceof Error ? error.message : 'Failed to list models' };
    }
  }

  private async recordModelTraining(record: {
    modelName: string; modelType: string; accuracy: number;
    modelPath: string; trainingCases: number; sectors: string[];
  }): Promise<void> {
    try {
      await db.insert(trainingData).values({
        stockSymbol: 'MODEL_TRAINING', sector: record.sectors.join(','),
        predictionDate: new Date(), predictedDirection: 'neutral', actualDirection: 'neutral',
        accuracy: record.accuracy, actualReturn: 0,
        planetaryConfig: JSON.stringify({ model_name: record.modelName, model_type: record.modelType, model_path: record.modelPath, training_cases: record.trainingCases, sectors: record.sectors }),
        dashaConfig:  JSON.stringify({ type: 'model_training' }),
        transitConfig: JSON.stringify({ created_at: new Date().toISOString() }),
      });
    } catch (error) {
      console.error('Failed to record model training:', error);
    }
  }

  async getPerformanceMetrics(lookbackDays = 30): Promise<{
    accuracy: number; profitability: number; bestSectors: string[];
    bestPlanetaryConfigs: any[]; recommendations: string[]; trainedModels?: any[];
  }> {
    try {
      const recentData = await db.select().from(trainingData)
        .orderBy(desc(trainingData.createdAt)).limit(100);

      if (recentData.length === 0) {
        return {
          accuracy: 0, profitability: 0, bestSectors: [],
          bestPlanetaryConfigs: [],
          recommendations: ['No historical data available. Start training with real cases.'],
        };
      }

      const totalAccuracy = recentData.reduce((sum, d) => sum + d.accuracy, 0) / recentData.length;
      const totalReturn   = recentData.reduce((sum, d) => sum + d.actualReturn, 0);

      const sectorPerf: Record<string, { accuracy: number; returns: number; count: number }> = {};
      recentData.forEach(data => {
        if (data.sector) {
          if (!sectorPerf[data.sector]) sectorPerf[data.sector] = { accuracy: 0, returns: 0, count: 0 };
          sectorPerf[data.sector].accuracy += data.accuracy;
          sectorPerf[data.sector].returns  += data.actualReturn;
          sectorPerf[data.sector].count++;
        }
      });

      const bestSectors = Object.entries(sectorPerf)
        .sort((a, b) => (b[1].accuracy / b[1].count) - (a[1].accuracy / a[1].count))
        .slice(0, 3).map(([sector]) => sector);

      const successfulConfigs = recentData
        .filter(d => d.accuracy > 70)
        .map(d => JSON.parse(d.planetaryConfig)).slice(0, 5);

      const recommendations = this.generateRecommendations(totalAccuracy, totalReturn, bestSectors, successfulConfigs);
      const modelsResult    = await this.listAvailableModels();

      return {
        accuracy: totalAccuracy, profitability: totalReturn,
        bestSectors, bestPlanetaryConfigs: successfulConfigs, recommendations,
        trainedModels: modelsResult.success ? modelsResult.models : [],
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return { accuracy: 0, profitability: 0, bestSectors: [], bestPlanetaryConfigs: [], recommendations: ['Error fetching performance data'] };
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private prepareChartContext(d1Chart: any, d9Chart: any, d10Chart: any, transits: any[], dashaSystem: any, horaSystem: any): string {
    return JSON.stringify({
      d1Chart:  { houses: d1Chart.houses, planets: d1Chart.planets, aspects: d1Chart.aspects, yogas: d1Chart.yogas },
      d9Chart:  { planets: d9Chart.plan **...**

_This response is too long to display in full._
