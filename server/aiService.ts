import OpenAI from 'openai';
import { stockDataService } from './stockDataService';
import { feedbackLearningService } from './feedbackLearningService';
import { astrologyService } from './astrologyService';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface AIAnalysisResult {
  prediction: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    priceTarget: {
      low: number;
      high: number;
    };
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
  private isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async analyzeStock(symbol: string, currentPrice: number, historicalData?: any[]): Promise<AIAnalysisResult | null> {
    if (!this.isConfigured()) {
      console.log('OpenAI API key not configured, falling back to mock predictions');
      return null;
    }

    try {
      // Get real-time stock data
      const stockQuote = await stockDataService.getStockQuote(symbol);
      const marketOverview = await stockDataService.getMarketOverview();

      // Prepare context for AI analysis
      const context = {
        symbol,
        currentPrice: stockQuote?.lastPrice || currentPrice,
        dayChange: stockQuote?.changePercent || 0,
        volume: stockQuote?.volume || 0,
        marketIndices: marketOverview?.indices || {},
        historicalTrend: historicalData?.slice(-10) || [], // Last 10 data points
      };

      // Create prompt for GPT
      const prompt = `
        As a financial analyst AI, analyze the following stock data and provide a prediction:

        Stock Symbol: ${context.symbol}
        Current Price: ₹${context.currentPrice}
        Day Change: ${context.dayChange}%
        Volume: ${context.volume}

        Market Context:
        - NIFTY 50: ${context.marketIndices.nifty50?.value || 'N/A'} (${context.marketIndices.nifty50?.changePercent || 0}%)
        - SENSEX: ${context.marketIndices.sensex?.value || 'N/A'} (${context.marketIndices.sensex?.changePercent || 0}%)

        Recent Price History: ${JSON.stringify(context.historicalTrend.slice(-5))}

        Please provide a JSON response with:
        {
          "prediction": {
            "direction": "bullish|bearish|neutral",
            "confidence": 0-100,
            "priceTarget": {
              "low": number,
              "high": number
            },
            "timeframe": "1-3 days"
          },
          "analysis": {
            "technicalFactors": ["factor1", "factor2"],
            "marketSentiment": "description",
            "keyRisks": ["risk1", "risk2"],
            "recommendation": "action"
          },
          "reasoning": "detailed explanation"
        }
      `;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a professional stock market analyst providing data-driven predictions. Always provide realistic, conservative estimates based on the data provided. Respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 800,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse AI response
      const aiResult = JSON.parse(response);

      return {
        prediction: {
          direction: aiResult.prediction?.direction || aiResult.direction || 'neutral',
          confidence: aiResult.prediction?.confidence || aiResult.confidence || 60,
          priceTarget: {
            low: aiResult.prediction?.priceTarget?.low || aiResult.priceTargetLow || currentPrice * 0.98,
            high: aiResult.prediction?.priceTarget?.high || aiResult.priceTargetHigh || currentPrice * 1.02,
          },
          timeframe: aiResult.prediction?.timeframe || aiResult.timeframe || '1-3 days',
        },
        analysis: {
          technicalFactors: aiResult.analysis?.technicalFactors || aiResult.technicalFactors || [],
          marketSentiment: aiResult.analysis?.marketSentiment || aiResult.marketSentiment || 'mixed',
          keyRisks: aiResult.analysis?.keyRisks || aiResult.keyRisks || [],
          recommendation: aiResult.analysis?.recommendation || aiResult.recommendation || 'Hold and observe',
        },
        reasoning: aiResult.reasoning || 'AI-powered technical analysis',
      };
    } catch (error) {
      console.error('Error in AI analysis:', error);
      return null;
    }
  }

  async generateMarketInsights(marketData: any): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const prompt = `
        Based on the following market data, provide a brief market insight (2-3 sentences):

        NIFTY 50: ${marketData.indices?.nifty50?.value} (${marketData.indices?.nifty50?.changePercent}%)
        SENSEX: ${marketData.indices?.sensex?.value} (${marketData.indices?.sensex?.changePercent}%)
        Top Gainers: ${marketData.topGainers?.slice(0, 3).map((s: any) => s.symbol).join(', ')}
        Top Losers: ${marketData.topLosers?.slice(0, 3).map((s: any) => s.symbol).join(', ')}

        Focus on the overall market trend and key movements.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a concise market analyst. Provide brief, actionable market insights."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      return completion.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('Error generating market insights:', error);
      return null;
    }
  }

  async assessRisk(stock: string, investment: number, timeHorizon: string): Promise<any> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const stockQuote = await stockDataService.getStockQuote(stock);

      const prompt = `
        Assess the investment risk for:
        Stock: ${stock}
        Investment Amount: ₹${investment}
        Time Horizon: ${timeHorizon}
        Current Price: ₹${stockQuote?.lastPrice || 0}
        Volatility (Day Change): ${stockQuote?.changePercent || 0}%

        Provide a risk assessment with:
        1. Risk Level (Low/Medium/High)
        2. Potential Loss Range
        3. Volatility Assessment
        4. Recommended Position Size
        5. Stop Loss Suggestion

        Format as JSON.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a risk management expert. Provide conservative risk assessments."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 300,
      });

      const response = completion.choices[0]?.message?.content;
      return response ? JSON.parse(response) : null;
    } catch (error) {
      console.error('Error in risk assessment:', error);
      return null;
    }
  }

  // Enhanced method that combines AI, Astrology, and Feedback Learning
  async generateEnhancedPrediction(
    symbol: string,
    currentPrice: number,
    userId?: string,
    historicalData?: any[]
  ): Promise<any> {
    try {
      // Step 1: Get feedback-based learning adjustments
      const learningAdjustment = userId 
        ? await feedbackLearningService.getLearningAdjustments(symbol, userId)
        : await feedbackLearningService.getLearningAdjustments(symbol);

      // Step 2: Get AI prediction (if configured)
      let aiPrediction = null;
      if (this.isConfigured()) {
        aiPrediction = await this.analyzeStock(symbol, currentPrice, historicalData);
      }

      // Step 3: Get Astrology prediction
      const astroPrediction = await astrologyService.generateAstroPrediction(
        symbol,
        new Date(),
        currentPrice
      );

      // Step 4: Combine predictions with astrology having more weight
      let combinedPrediction = astrologyService.combineAIAndAstroPredictions(
        aiPrediction,
        astroPrediction,
        learningAdjustment.confidenceAdjustment
      );

      // Step 5: Apply feedback learning adjustments
      if (learningAdjustment) {
        combinedPrediction = feedbackLearningService.applyLearningToPrediction(
          combinedPrediction,
          learningAdjustment
        );
      }

      // Step 6: Add user personalization if userId provided
      if (userId) {
        const personalization = await feedbackLearningService.getUserPersonalization(userId);
        combinedPrediction.userPersonalization = personalization;

        // Apply personalized confidence boost
        if (combinedPrediction.confidence) {
          combinedPrediction.confidence = Math.min(
            95,
            combinedPrediction.confidence + personalization.personalizedConfidenceBoost
          );
        }
      }

      // Step 7: Add metadata about prediction sources
      combinedPrediction.metadata = {
        aiEnabled: this.isConfigured() && aiPrediction !== null,
        astroEnabled: true,
        feedbackLearningApplied: true,
        predictionTime: new Date().toISOString(),
        sources: {
          ai: aiPrediction ? 'OpenAI GPT-3.5' : 'Not configured',
          astrology: 'Advanced Vedic Astrology with Drikpanchang',
          feedback: learningAdjustment.suggestedFactors.length > 0 ? 'Active learning from user feedback' : 'No feedback data'
        }
      };

      return combinedPrediction;
    } catch (error) {
      console.error('Error generating enhanced prediction:', error);

      // Fallback to astrology-only prediction
      const astroPrediction = await astrologyService.generateAstroPrediction(
        symbol,
        new Date(),
        currentPrice
      );

      return astrologyService.combineAIAndAstroPredictions(null, astroPrediction, 0);
    }
  }

  // Generate enhanced crypto prediction
  async generateEnhancedCryptoPrediction(
    cryptoSymbol: string,
    currentPrice: number,
    userId: string,
    historicalData: any[] = [],
    cryptoQuote?: any
  ): Promise<any> {
    try {
      // Get astrology analysis
      const astroAnalysis = await astrologyService.getCurrentAstrology(new Date());

      // Get user feedback insights
      const userPersonalization = await feedbackLearningService.getUserPersonalization(userId);

      let aiPrediction = null;
      let metadata = {
        aiEnabled: false,
        feedbackLearningApplied: true,
        sources: ['astrology', 'feedback']
      };

      // Generate AI prediction if OpenAI is configured
      if (this.isConfigured()) {
        try {
          const cryptoContext = {
            symbol: cryptoSymbol,
            name: cryptoQuote?.name || cryptoSymbol,
            currentPrice,
            marketCap: cryptoQuote?.marketCap || 0,
            volume24h: cryptoQuote?.volume24h || 0,
            change24h: cryptoQuote?.changePercent24h || 0,
            volatility: 'high',
            recentData: historicalData.slice(-10),
            marketSentiment: 'crypto markets are highly volatile and sentiment-driven'
          };

          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are an expert cryptocurrency analyst. Analyze the provided crypto data and give precise predictions.
                Consider crypto-specific factors like:
                - High volatility and sentiment-driven price movements
                - Market adoption and technology developments  
                - Regulatory concerns and news impact
                - Trading volume and market cap trends
                - Technical indicators adapted for crypto markets

                Provide specific price targets and confidence levels. Be more conservative with confidence due to crypto volatility.`
              },
              {
                role: "user", 
                content: `Analyze ${cryptoSymbol} cryptocurrency:
                Current Price: $${currentPrice}
                Market Cap: $${cryptoQuote?.marketCap?.toLocaleString() || 'N/A'}
                24h Volume: $${cryptoQuote?.volume24h?.toLocaleString() || 'N/A'}
                24h Change: ${cryptoQuote?.changePercent24h?.toFixed(2) || 0}%

                Recent price history: ${JSON.stringify(historicalData.slice(-5))}

                Provide: direction, confidence (max 80% for crypto), price targets, timeframe, key factors, and risks.`
              }
            ],
            max_tokens: 1000,
            temperature: 0.3
          });

          const aiResponse = response.choices[0]?.message?.content;
          if (aiResponse) {
            aiPrediction = this.parseAIPrediction(aiResponse, currentPrice);
            metadata.aiEnabled = true;
            metadata.sources.unshift('openai');
          }
        } catch (aiError) {
          console.error('OpenAI crypto prediction error:', aiError);
        }
      }

      // Generate astrology-based crypto prediction
      const astroStrength = this.calculateCryptoAstroStrength(astroAnalysis, cryptoSymbol);
      const cryptoAstroPrediction = this.generateCryptoAstroPrediction(currentPrice, astroAnalysis, astroStrength);

      // Combine predictions (astrology has higher weight for crypto due to volatility)
      const combinedPrediction = this.combineCryptoPredictions(aiPrediction, cryptoAstroPrediction, currentPrice);

      // Apply feedback learning
      const personalizedPrediction = await feedbackLearningService.applyPersonalization(
        userId,
        `CRYPTO_${cryptoSymbol}`,
        combinedPrediction
      );

      return {
        ...personalizedPrediction,
        astroFactors: astroAnalysis,
        astroStrength,
        metadata,
        userPersonalization: userPersonalization ? {
          accuracyBoost: userPersonalization.accuracyBoost,
          preferredRiskLevel: userPersonalization.preferredRiskLevel,
          learningPhase: userPersonalization.learningPhase
        } : null,
        learningInsights: await feedbackLearningService.getStockMetrics(`CRYPTO_${cryptoSymbol}`)
      };

    } catch (error) {
      console.error('Enhanced crypto prediction error:', error);

      // Fallback to simple astrology prediction
      const fallbackAstro = await astrologyService.getCurrentAstrology(new Date());
      const fallbackStrength = this.calculateCryptoAstroStrength(fallbackAstro, cryptoSymbol);

      return this.generateCryptoAstroPrediction(currentPrice, fallbackAstro, fallbackStrength);
    }
  }

  private parseAIPrediction(response: string, currentPrice: number): any {
    try {
      const data = JSON.parse(response);
      return {
        prediction: {
          direction: data.direction || data.prediction?.direction || 'neutral',
          confidence: Math.min(data.confidence || data.prediction?.confidence || 60, 80), // Max 80% for crypto
          priceTarget: {
            low: data.priceTarget?.low || data.priceTargetLow || currentPrice * 0.95,
            high: data.priceTarget?.high || data.priceTargetHigh || currentPrice * 1.05
          },
          timeframe: data.timeframe || data.prediction?.timeframe || '24-72 hours'
        },
        analysis: {
          technicalFactors: data.keyFactors || data.analysis?.technicalFactors || [],
          marketSentiment: data.marketSentiment || data.analysis?.marketSentiment || 'volatile',
          keyRisks: data.risks || data.analysis?.keyRisks || [],
          recommendation: data.recommendation || data.analysis?.recommendation || 'Monitor closely'
        },
        reasoning: data.reasoning || 'AI-driven crypto analysis'
      };
    } catch (error) {
      console.error('Error parsing AI crypto prediction:', error);
      return null;
    }
  }


  private calculateCryptoAstroStrength(astroAnalysis: any, cryptoSymbol: string): number {
    // Crypto-specific astrology mapping
    const cryptoAstroMapping = {
      'BTC': { planet: 'Sun', strength: 0.9 }, // Bitcoin - Sun ruled, king of crypto
      'ETH': { planet: 'Mercury', strength: 0.85 }, // Ethereum - Mercury ruled, smart contracts
      'BNB': { planet: 'Venus', strength: 0.7 }, // Binance - Venus ruled, exchange/trade
      'ADA': { planet: 'Jupiter', strength: 0.75 }, // Cardano - Jupiter ruled, wisdom/research
      'SOL': { planet: 'Mars', strength: 0.8 }, // Solana - Mars ruled, fast/aggressive
      'XRP': { planet: 'Saturn', strength: 0.6 }, // Ripple - Saturn ruled, institutional/slow
      'DOT': { planet: 'Mercury', strength: 0.7 }, // Polkadot - Mercury ruled, interoperability
      'MATIC': { planet: 'Moon', strength: 0.65 }, // Polygon - Moon ruled, scaling/adaptive
      'AVAX': { planet: 'Mars', strength: 0.75 }, // Avalanche - Mars ruled, fast consensus
      'ATOM': { planet: 'Jupiter', strength: 0.7 }  // Cosmos - Jupiter ruled, universal connection
    };

    const cryptoData = cryptoAstroMapping[cryptoSymbol as keyof typeof cryptoAstroMapping] || 
                     { planet: 'Mercury', strength: 0.6 }; // Default to Mercury for tech

    const basePlanetaryStrength = astroAnalysis.planetary?.[cryptoData.planet.toLowerCase()] || 50;
    const cryptoSpecificStrength = basePlanetaryStrength * cryptoData.strength;

    // Crypto markets are more volatile, so reduce overall confidence
    return Math.min(cryptoSpecificStrength * 0.85, 80); // Max 80% confidence for crypto
  }

  private generateCryptoAstroPrediction(currentPrice: number, astroAnalysis: any, astroStrength: number): any {
    const volatilityFactor = 1.6; // Crypto is more volatile than stocks
    const priceVariation = (astroStrength - 50) / 100 * volatilityFactor;

    const targetLow = currentPrice * (1 - Math.abs(priceVariation) * 0.12); // ±12% range
    const targetHigh = currentPrice * (1 + Math.abs(priceVariation) * 0.12);

    const direction = priceVariation > 0.05 ? 'bullish' : 
                     priceVariation < -0.05 ? 'bearish' : 'neutral';

    return {
      prediction: {
        direction,
        priceTarget: {
          low: Math.round(targetLow * 100) / 100,
          high: Math.round(targetHigh * 100) / 100
        }
      },
      confidence: Math.round(astroStrength),
      finalDirection: direction,
      astroRecommendation: this.getCryptoAstroRecommendation(astroStrength, direction),
      reasoning: 'Cryptocurrency astrology analysis with volatility adjustments'
    };
  }

  private combineCryptoPredictions(aiPrediction: any, astroPrediction: any, currentPrice: number): any {
    if (!aiPrediction) {
      return astroPrediction;
    }

    // For crypto, give astrology higher weight due to market volatility and sentiment
    const aiWeight = 0.35;
    const astroWeight = 0.65;

    const combinedConfidence = (aiPrediction.confidence * aiWeight) + (astroPrediction.confidence * astroWeight);

    // Combine price targets with crypto volatility adjustment
    const aiLow = aiPrediction.prediction?.priceTarget?.low || currentPrice * 0.92;
    const aiHigh = aiPrediction.prediction?.priceTarget?.high || currentPrice * 1.08;
    const astroLow = astroPrediction.prediction?.priceTarget?.low || currentPrice * 0.88;
    const astroHigh = astroPrediction.prediction?.priceTarget?.high || currentPrice * 1.12;

    const combinedLow = (aiLow * aiWeight) + (astroLow * astroWeight);
    const combinedHigh = (aiHigh * aiWeight) + (astroHigh * astroWeight);

    // Final direction based on astrology precedence
    const finalDirection = astroPrediction.finalDirection || aiPrediction.prediction?.direction || 'neutral';

    return {
      prediction: {
        direction: finalDirection,
        priceTarget: {
          low: Math.round(combinedLow * 100) / 100,
          high: Math.round(combinedHigh * 100) / 100
        }
      },
      combinedConfidence: Math.round(combinedConfidence),
      confidence: Math.round(combinedConfidence),
      finalDirection,
      analysis: aiPrediction.analysis,
      astroRecommendation: astroPrediction.astroRecommendation,
      reasoning: `Combined AI (${aiWeight * 100}%) + Astrology (${astroWeight * 100}%) crypto analysis`
    };
  }

  private getCryptoAstroRecommendation(strength: number, direction: string): string {
    const recommendations = {
      bullish: strength > 70 ? 'Strong Buy - Excellent planetary alignment for crypto growth' :
               strength > 60 ? 'Buy - Good cosmic energy for upward movement' :
               'Weak Buy - Proceed with caution despite positive signals',
      bearish: strength < 40 ? 'Strong Sell - Planetary forces suggest significant decline' :
               strength < 50 ? 'Sell - Negative cosmic influences present' :
               'Weak Sell - Mixed signals, consider reducing position',
      neutral: 'Hold - Balanced planetary energies, wait for clearer signals'
    };

    return recommendations[direction as keyof typeof recommendations] || 'Hold and observe market conditions';
  }
}

export const aiService = new AIService();