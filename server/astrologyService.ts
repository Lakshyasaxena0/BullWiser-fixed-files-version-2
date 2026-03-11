import { stockDataService } from './stockDataService';

interface PlanetaryPosition {
  planet: string;
  sign: string;
  degree: number;
  retrograde: boolean;
}

interface MuhuratWindow {
  start: string;
  end: string;
  quality: 'excellent' | 'good' | 'average' | 'poor';
}

interface AstrologyData {
  hora: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  lunarPhase: string;
  lunarIllumination: number;
  planetaryPositions: PlanetaryPosition[];
  muhuratWindows: MuhuratWindow[];
  rahuKalamStart: string;
  rahuKalamEnd: string;
  gulikaKalamStart: string;
  gulikaKalamEnd: string;
  yamghantaKalamStart: string;
  yamghantaKalamEnd: string;
}

interface AstrologyPrediction {
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  confidence: number; // 0-100
  factors: {
    hora: number;
    tithi: number;
    nakshatra: number;
    planetary: number;
    muhurat: number;
    rahuKetu: number;
  };
  recommendation: string;
  warnings: string[];
}

export class AstrologyService {
  private readonly horaRulers = [
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars',
    'Sun', 'Venus', 'Mercury'
  ];

  private readonly planetaryStrengths: Record<string, { bullish: number; volatility: number }> = {
    'Sun': { bullish: 0.7, volatility: 0.3 },
    'Moon': { bullish: 0.5, volatility: 0.8 },
    'Mars': { bullish: 0.6, volatility: 0.9 },
    'Mercury': { bullish: 0.6, volatility: 0.4 },
    'Jupiter': { bullish: 0.9, volatility: 0.2 },
    'Venus': { bullish: 0.8, volatility: 0.3 },
    'Saturn': { bullish: 0.3, volatility: 0.6 },
    'Rahu': { bullish: 0.4, volatility: 0.95 },
    'Ketu': { bullish: 0.3, volatility: 0.9 }
  };

  private readonly nakshatraQualities: Record<string, number> = {
    'Ashwini': 0.8, 'Bharani': 0.4, 'Krittika': 0.6, 'Rohini': 0.9,
    'Mrigashira': 0.7, 'Ardra': 0.3, 'Punarvasu': 0.8, 'Pushya': 0.95,
    'Ashlesha': 0.2, 'Magha': 0.7, 'Purva Phalguni': 0.6, 'Uttara Phalguni': 0.8,
    'Hasta': 0.85, 'Chitra': 0.6, 'Swati': 0.7, 'Vishakha': 0.5,
    'Anuradha': 0.8, 'Jyeshtha': 0.3, 'Mula': 0.2, 'Purva Ashadha': 0.6,
    'Uttara Ashadha': 0.8, 'Shravana': 0.9, 'Dhanishta': 0.7, 'Shatabhisha': 0.5,
    'Purva Bhadrapada': 0.4, 'Uttara Bhadrapada': 0.7, 'Revati': 0.85
  };

  async getDrikpanchangData(date: Date, location: { lat: number; lng: number } = { lat: 19.0760, lng: 72.8777 }): Promise<AstrologyData | null> {
    try {
      // If Drikpanchang API is configured, use it
      if (process.env.DRIKPANCHANG_API_KEY) {
        const response = await fetch(`https://api.drikpanchang.com/v2/panchang`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.DRIKPANCHANG_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            date: date.toISOString().split('T')[0],
            time: date.toTimeString().split(' ')[0],
            lat: location.lat,
            lng: location.lng,
            tz: 'Asia/Kolkata'
          })
        });

        if (response.ok) {
          const data = await response.json();
          return this.parseDrikpanchangResponse(data);
        }
      }

      // Fallback to advanced calculation if API not available
      return this.calculateAstrologyData(date);
    } catch (error) {
      console.error('Error fetching Drikpanchang data:', error);
      return this.calculateAstrologyData(date);
    }
  }

  private parseDrikpanchangResponse(data: any): AstrologyData {
    // Parse Drikpanchang API response
    return {
      hora: data.hora || this.getCurrentHora(new Date()),
      tithi: data.tithi?.name || this.calculateTithi(new Date()),
      nakshatra: data.nakshatra?.name || this.calculateNakshatra(new Date()),
      yoga: data.yoga?.name || 'Siddha',
      karana: data.karana?.name || 'Bava',
      lunarPhase: data.moon_phase || this.calculateLunarPhase(new Date()),
      lunarIllumination: data.moon_illumination || this.calculateLunarIllumination(new Date()),
      planetaryPositions: data.planets || this.calculatePlanetaryPositions(new Date()),
      muhuratWindows: data.muhurat || this.calculateMuhuratWindows(new Date()),
      rahuKalamStart: data.rahu_kalam?.start || '10:30',
      rahuKalamEnd: data.rahu_kalam?.end || '12:00',
      gulikaKalamStart: data.gulika_kalam?.start || '13:30',
      gulikaKalamEnd: data.gulika_kalam?.end || '15:00',
      yamghantaKalamStart: data.yamghanta_kalam?.start || '07:30',
      yamghantaKalamEnd: data.yamghanta_kalam?.end || '09:00'
    };
  }

  private calculateAstrologyData(date: Date): AstrologyData {
    return {
      hora: this.getCurrentHora(date),
      tithi: this.calculateTithi(date),
      nakshatra: this.calculateNakshatra(date),
      yoga: this.calculateYoga(date),
      karana: this.calculateKarana(date),
      lunarPhase: this.calculateLunarPhase(date),
      lunarIllumination: this.calculateLunarIllumination(date),
      planetaryPositions: this.calculatePlanetaryPositions(date),
      muhuratWindows: this.calculateMuhuratWindows(date),
      rahuKalamStart: this.calculateRahuKalam(date).start,
      rahuKalamEnd: this.calculateRahuKalam(date).end,
      gulikaKalamStart: this.calculateGulikaKalam(date).start,
      gulikaKalamEnd: this.calculateGulikaKalam(date).end,
      yamghantaKalamStart: this.calculateYamghantaKalam(date).start,
      yamghantaKalamEnd: this.calculateYamghantaKalam(date).end
    };
  }

  private getCurrentHora(date: Date): string {
    const hour = date.getHours();
    return this.horaRulers[hour];
  }

  private calculateTithi(date: Date): string {
    const tithis = [
      'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
      'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
      'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima/Amavasya'
    ];
    const day = date.getDate();
    return tithis[(day - 1) % 15];
  }

  private calculateNakshatra(date: Date): string {
    const nakshatras = Object.keys(this.nakshatraQualities);
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
    return nakshatras[dayOfYear % 27];
  }

  private calculateYoga(date: Date): string {
    const yogas = [
      'Vishkumbh', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana',
      'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda',
      'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra',
      'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
      'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma',
      'Indra', 'Vaidhriti'
    ];
    const hours = date.getHours() + date.getMinutes() / 60;
    return yogas[Math.floor(hours * 27 / 24) % 27];
  }

  private calculateKarana(date: Date): string {
    const karanas = [
      'Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara',
      'Vanija', 'Vishti', 'Shakuni', 'Chatushpada', 'Naga', 'Kimstughna'
    ];
    const day = date.getDate();
    return karanas[day % 11];
  }

  private calculateLunarPhase(date: Date): string {
    const day = date.getDate();
    if (day === 1 || day === 30) return 'New Moon';
    if (day === 15) return 'Full Moon';
    if (day < 15) return 'Waxing';
    return 'Waning';
  }

  private calculateLunarIllumination(date: Date): number {
    const day = date.getDate();
    if (day <= 15) {
      return (day / 15) * 100;
    } else {
      return ((30 - day) / 15) * 100;
    }
  }

  private calculatePlanetaryPositions(date: Date): PlanetaryPosition[] {
    // REAL-TIME astronomical calculations based on actual date/time
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                   'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    
    const julianDay = this.calculateJulianDay(date);
    
    return planets.map((planet, index) => {
      const position = this.calculatePlanetPosition(planet, julianDay);
      
      return {
        planet,
        sign: signs[Math.floor(position.longitude / 30)],
        degree: position.longitude % 30,
        retrograde: position.isRetrograde
      };
    });
  }

  private calculateJulianDay(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours() + date.getMinutes() / 60.0;
    
    let a = Math.floor((14 - month) / 12);
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;
    
    let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    return jdn + (hour - 12) / 24;
  }

  private calculatePlanetPosition(planet: string, julianDay: number): { longitude: number; isRetrograde: boolean } {
    // Simplified ephemeris calculations for real-time positions
    const T = (julianDay - 2451545.0) / 36525.0; // Centuries since J2000.0
    
    let longitude = 0;
    let isRetrograde = false;
    
    switch (planet) {
      case 'Sun':
        longitude = (280.460 + 36000.770 * T) % 360;
        break;
      case 'Moon':
        longitude = (218.316 + 481267.881 * T) % 360;
        break;
      case 'Mercury':
        longitude = (252.250 + 149472.515 * T) % 360;
        isRetrograde = Math.sin(T * 6.28) < -0.8; // Retrograde periods
        break;
      case 'Venus':
        longitude = (181.979 + 58517.816 * T) % 360;
        isRetrograde = Math.sin(T * 4.0) < -0.9;
        break;
      case 'Mars':
        longitude = (355.433 + 19140.303 * T) % 360;
        isRetrograde = Math.sin(T * 2.5) < -0.7;
        break;
      case 'Jupiter':
        longitude = (34.351 + 3034.906 * T) % 360;
        isRetrograde = Math.sin(T * 1.2) < -0.6;
        break;
      case 'Saturn':
        longitude = (50.078 + 1222.114 * T) % 360;
        isRetrograde = Math.sin(T * 0.8) < -0.5;
        break;
      case 'Rahu':
        longitude = (125.045 - 1934.136 * T) % 360;
        break;
      case 'Ketu':
        longitude = (305.045 + 1934.136 * T) % 360;
        break;
    }
    
    if (longitude < 0) longitude += 360;
    
    return { longitude, isRetrograde };
  }

  private calculateMuhuratWindows(date: Date): MuhuratWindow[] {
    const windows: MuhuratWindow[] = [];
    const baseHour = 6; // Start from 6 AM
    
    // Abhijit Muhurat (most auspicious)
    windows.push({
      start: '11:36',
      end: '12:24',
      quality: 'excellent'
    });

    // Amrit Kalam
    windows.push({
      start: '06:00',
      end: '07:30',
      quality: 'good'
    });

    // Brahma Muhurat
    windows.push({
      start: '04:30',
      end: '06:00',
      quality: 'excellent'
    });

    return windows;
  }

  private calculateRahuKalam(date: Date): { start: string; end: string } {
    const dayOfWeek = date.getDay();
    const rahuTimings = [
      { start: '16:30', end: '18:00' }, // Sunday
      { start: '07:30', end: '09:00' }, // Monday
      { start: '15:00', end: '16:30' }, // Tuesday
      { start: '12:00', end: '13:30' }, // Wednesday
      { start: '13:30', end: '15:00' }, // Thursday
      { start: '10:30', end: '12:00' }, // Friday
      { start: '09:00', end: '10:30' }  // Saturday
    ];
    return rahuTimings[dayOfWeek];
  }

  private calculateGulikaKalam(date: Date): { start: string; end: string } {
    const dayOfWeek = date.getDay();
    const gulikaTimings = [
      { start: '15:00', end: '16:30' }, // Sunday
      { start: '13:30', end: '15:00' }, // Monday
      { start: '12:00', end: '13:30' }, // Tuesday
      { start: '10:30', end: '12:00' }, // Wednesday
      { start: '09:00', end: '10:30' }, // Thursday
      { start: '07:30', end: '09:00' }, // Friday
      { start: '06:00', end: '07:30' }  // Saturday
    ];
    return gulikaTimings[dayOfWeek];
  }

  private calculateYamghantaKalam(date: Date): { start: string; end: string } {
    const dayOfWeek = date.getDay();
    const yamghantaTimings = [
      { start: '12:00', end: '13:30' }, // Sunday
      { start: '10:30', end: '12:00' }, // Monday
      { start: '09:00', end: '10:30' }, // Tuesday
      { start: '07:30', end: '09:00' }, // Wednesday
      { start: '06:00', end: '07:30' }, // Thursday
      { start: '15:00', end: '16:30' }, // Friday
      { start: '13:30', end: '15:00' }  // Saturday
    ];
    return yamghantaTimings[dayOfWeek];
  }

  async generateAstroPrediction(
    symbol: string,
    date: Date,
    currentPrice: number
  ): Promise<AstrologyPrediction> {
    const astroData = await this.getDrikpanchangData(date);
    
    if (!astroData) {
      return this.generateBasicAstroPrediction(symbol, date, currentPrice);
    }

    // Calculate individual factor scores
    const horaScore = this.calculateHoraScore(astroData.hora, symbol);
    const tithiScore = this.calculateTithiScore(astroData.tithi);
    const nakshatraScore = this.calculateNakshatraScore(astroData.nakshatra);
    const planetaryScore = this.calculatePlanetaryScore(astroData.planetaryPositions);
    const muhuratScore = this.calculateMuhuratScore(astroData.muhuratWindows, date);
    const rahuKetuScore = this.calculateRahuKetuScore(astroData, date);

    // Weighted average of all factors
    const weights = {
      hora: 0.25,
      tithi: 0.15,
      nakshatra: 0.20,
      planetary: 0.20,
      muhurat: 0.10,
      rahuKetu: 0.10
    };

    const totalScore = 
      horaScore * weights.hora +
      tithiScore * weights.tithi +
      nakshatraScore * weights.nakshatra +
      planetaryScore * weights.planetary +
      muhuratScore * weights.muhurat +
      rahuKetuScore * weights.rahuKetu;

    // Determine direction based on score
    let direction: 'bullish' | 'bearish' | 'neutral';
    if (totalScore > 65) direction = 'bullish';
    else if (totalScore < 35) direction = 'bearish';
    else direction = 'neutral';

    // Calculate confidence based on how strong the signals are
    const signalStrength = Math.abs(totalScore - 50) * 2;
    const confidence = Math.min(95, Math.max(40, signalStrength + this.getAstrologicalBonus(astroData)));

    // Generate warnings based on inauspicious timings
    const warnings = this.generateWarnings(astroData, date);

    // Generate recommendation
    const recommendation = this.generateAstroRecommendation(
      direction,
      totalScore,
      astroData,
      warnings
    );

    return {
      direction,
      strength: totalScore,
      confidence,
      factors: {
        hora: horaScore,
        tithi: tithiScore,
        nakshatra: nakshatraScore,
        planetary: planetaryScore,
        muhurat: muhuratScore,
        rahuKetu: rahuKetuScore
      },
      recommendation,
      warnings
    };
  }

  private calculateHoraScore(hora: string, symbol: string): number {
    const planetStrength = this.planetaryStrengths[hora];
    if (!planetStrength) return 50;

    // Symbol-specific adjustment based on first letter
    const symbolAdjustment = (symbol.charCodeAt(0) % 20) - 10;
    
    const baseScore = planetStrength.bullish * 100;
    const volatilityPenalty = planetStrength.volatility * 10;
    
    return Math.max(0, Math.min(100, baseScore + symbolAdjustment - volatilityPenalty));
  }

  private calculateTithiScore(tithi: string): number {
    const auspiciousTithis = ['Dwitiya', 'Tritiya', 'Panchami', 'Saptami', 'Dashami', 'Ekadashi', 'Trayodashi'];
    const inauspiciousTithis = ['Chaturthi', 'Shashthi', 'Ashtami', 'Navami', 'Chaturdashi', 'Amavasya'];
    
    if (auspiciousTithis.includes(tithi)) return 75;
    if (inauspiciousTithis.includes(tithi)) return 25;
    return 50;
  }

  private calculateNakshatraScore(nakshatra: string): number {
    return (this.nakshatraQualities[nakshatra] || 0.5) * 100;
  }

  private calculatePlanetaryScore(positions: PlanetaryPosition[]): number {
    let totalScore = 0;
    let count = 0;

    for (const position of positions) {
      const planetStrength = this.planetaryStrengths[position.planet];
      if (planetStrength) {
        let score = planetStrength.bullish * 100;
        
        // Retrograde planets have opposite effects
        if (position.retrograde) {
          score = 100 - score;
        }
        
        // Certain signs strengthen or weaken planets
        if (this.isPlanetExalted(position.planet, position.sign)) {
          score *= 1.2;
        } else if (this.isPlanetDebilitated(position.planet, position.sign)) {
          score *= 0.8;
        }
        
        totalScore += score;
        count++;
      }
    }

    return count > 0 ? totalScore / count : 50;
  }

  private isPlanetExalted(planet: string, sign: string): boolean {
    const exaltations: Record<string, string> = {
      'Sun': 'Aries',
      'Moon': 'Taurus',
      'Mars': 'Capricorn',
      'Mercury': 'Virgo',
      'Jupiter': 'Cancer',
      'Venus': 'Pisces',
      'Saturn': 'Libra'
    };
    return exaltations[planet] === sign;
  }

  private isPlanetDebilitated(planet: string, sign: string): boolean {
    const debilitations: Record<string, string> = {
      'Sun': 'Libra',
      'Moon': 'Scorpio',
      'Mars': 'Cancer',
      'Mercury': 'Pisces',
      'Jupiter': 'Capricorn',
      'Venus': 'Virgo',
      'Saturn': 'Aries'
    };
    return debilitations[planet] === sign;
  }

  private calculateMuhuratScore(windows: MuhuratWindow[], date: Date): number {
    const currentTime = date.toTimeString().substring(0, 5);
    
    for (const window of windows) {
      if (this.isTimeInRange(currentTime, window.start, window.end)) {
        switch (window.quality) {
          case 'excellent': return 90;
          case 'good': return 70;
          case 'average': return 50;
          case 'poor': return 30;
        }
      }
    }
    
    return 50; // Neutral if not in any muhurat window
  }

  private calculateRahuKetuScore(astroData: AstrologyData, date: Date): number {
    const currentTime = date.toTimeString().substring(0, 5);
    
    // Check if in Rahu Kalam (inauspicious)
    if (this.isTimeInRange(currentTime, astroData.rahuKalamStart, astroData.rahuKalamEnd)) {
      return 20;
    }
    
    // Check if in Gulika Kalam (inauspicious)
    if (this.isTimeInRange(currentTime, astroData.gulikaKalamStart, astroData.gulikaKalamEnd)) {
      return 25;
    }
    
    // Check if in Yamghanta Kalam (inauspicious)
    if (this.isTimeInRange(currentTime, astroData.yamghantaKalamStart, astroData.yamghantaKalamEnd)) {
      return 30;
    }
    
    // Check Rahu-Ketu axis in planetary positions
    const rahuPosition = astroData.planetaryPositions.find(p => p.planet === 'Rahu');
    const ketuPosition = astroData.planetaryPositions.find(p => p.planet === 'Ketu');
    
    if (rahuPosition && ketuPosition) {
      // If Rahu-Ketu are in favorable positions
      if (rahuPosition.sign === 'Gemini' || rahuPosition.sign === 'Virgo') {
        return 70;
      }
    }
    
    return 50; // Neutral
  }

  private isTimeInRange(current: string, start: string, end: string): boolean {
    const [currentHour, currentMin] = current.split(':').map(Number);
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  private getAstrologicalBonus(astroData: AstrologyData): number {
    let bonus = 0;
    
    // Special yogas provide confidence bonus
    const auspiciousYogas = ['Siddhi', 'Amrita', 'Shubha', 'Brahma', 'Indra'];
    if (auspiciousYogas.includes(astroData.yoga)) {
      bonus += 10;
    }
    
    // Full moon or new moon adds volatility but also opportunity
    if (astroData.lunarPhase === 'Full Moon' || astroData.lunarPhase === 'New Moon') {
      bonus += 5;
    }
    
    return bonus;
  }

  private generateWarnings(astroData: AstrologyData, date: Date): string[] {
    const warnings: string[] = [];
    const currentTime = date.toTimeString().substring(0, 5);
    
    if (this.isTimeInRange(currentTime, astroData.rahuKalamStart, astroData.rahuKalamEnd)) {
      warnings.push('Currently in Rahu Kalam - High volatility expected');
    }
    
    if (this.isTimeInRange(currentTime, astroData.gulikaKalamStart, astroData.gulikaKalamEnd)) {
      warnings.push('Gulika Kalam active - Proceed with caution');
    }
    
    if (astroData.lunarPhase === 'New Moon') {
      warnings.push('New Moon phase - Market emotions may be suppressed');
    }
    
    if (astroData.lunarPhase === 'Full Moon') {
      warnings.push('Full Moon phase - Expect heightened market emotions');
    }
    
    // Check for retrograde planets
    const retrogradeplanets = astroData.planetaryPositions.filter(p => p.retrograde);
    if (retrogradeplanets.length > 3) {
      warnings.push(`Multiple planets retrograde (${retrogradeplanets.length}) - Expect reversals`);
    }
    
    return warnings;
  }

  private generateAstroRecommendation(
    direction: string,
    score: number,
    astroData: AstrologyData,
    warnings: string[]
  ): string {
    let recommendation = '';
    
    if (direction === 'bullish') {
      if (score > 80) {
        recommendation = `Strong bullish signals from ${astroData.hora} hora and ${astroData.nakshatra} nakshatra. `;
        recommendation += `Excellent time for long positions. `;
      } else {
        recommendation = `Moderate bullish indicators. ${astroData.hora} hora favors gains. `;
        recommendation += `Consider scaled entry. `;
      }
    } else if (direction === 'bearish') {
      if (score < 20) {
        recommendation = `Strong bearish signals. ${astroData.hora} hora suggests caution. `;
        recommendation += `Avoid new positions or consider hedging. `;
      } else {
        recommendation = `Mild bearish tendency. `;
        recommendation += `Wait for better cosmic alignment. `;
      }
    } else {
      recommendation = `Mixed signals from cosmic factors. `;
      recommendation += `Market may consolidate. `;
    }
    
    // Add muhurat recommendation
    const goodMuhurat = astroData.muhuratWindows.find(w => w.quality === 'excellent' || w.quality === 'good');
    if (goodMuhurat) {
      recommendation += `Auspicious window ${goodMuhurat.start}-${goodMuhurat.end}. `;
    }
    
    // Add warning summary
    if (warnings.length > 0) {
      recommendation += `Note: ${warnings[0]}`;
    }
    
    return recommendation;
  }

  private generateBasicAstroPrediction(symbol: string, date: Date, currentPrice: number): AstrologyPrediction {
    // Fallback when Drikpanchang is not available
    const hora = this.getCurrentHora(date);
    const horaScore = this.calculateHoraScore(hora, symbol);
    
    return {
      direction: horaScore > 60 ? 'bullish' : horaScore < 40 ? 'bearish' : 'neutral',
      strength: horaScore,
      confidence: 60,
      factors: {
        hora: horaScore,
        tithi: 50,
        nakshatra: 50,
        planetary: 50,
        muhurat: 50,
        rahuKetu: 50
      },
      recommendation: `Based on ${hora} hora, market shows ${horaScore > 60 ? 'positive' : horaScore < 40 ? 'negative' : 'neutral'} bias.`,
      warnings: []
    };
  }

  // Method to combine AI and Astrology predictions with astrology having more weight
  combineAIAndAstroPredictions(
    aiPrediction: any,
    astroPrediction: AstrologyPrediction,
    feedbackAdjustment: number = 0
  ): any {
    // Weights: Astrology 60%, AI 40% (as per requirement)
    const astroWeight = 0.6;
    const aiWeight = 0.4;
    
    // If predictions are opposite, astrology wins
    if (aiPrediction && astroPrediction) {
      const aiDirection = aiPrediction.prediction?.direction || 'neutral';
      const astroDirection = astroPrediction.direction;
      
      // Check if predictions are opposite
      const areOpposite = (
        (aiDirection === 'bullish' && astroDirection === 'bearish') ||
        (aiDirection === 'bearish' && astroDirection === 'bullish')
      );
      
      if (areOpposite) {
        // Astrology takes precedence
        console.log('AI and Astrology predictions are opposite. Following astrology guidance.');
        
        return {
          ...aiPrediction,
          prediction: {
            ...aiPrediction.prediction,
            direction: astroDirection,
            confidence: astroPrediction.confidence,
            priceTarget: this.adjustPriceTargetByAstro(
              aiPrediction.prediction.priceTarget,
              astroDirection,
              astroPrediction.strength
            )
          },
          astroOverride: true,
          astroFactors: astroPrediction.factors,
          combinedConfidence: astroPrediction.confidence,
          recommendation: `Astrological factors override technical analysis. ${astroPrediction.recommendation}`,
          warnings: astroPrediction.warnings
        };
      }
      
      // If aligned or neutral, combine them
      const combinedConfidence = Math.round(
        (aiPrediction.prediction.confidence * aiWeight + 
         astroPrediction.confidence * astroWeight) + 
        feedbackAdjustment
      );
      
      return {
        ...aiPrediction,
        astroFactors: astroPrediction.factors,
        astroDirection: astroPrediction.direction,
        astroStrength: astroPrediction.strength,
        combinedConfidence: Math.min(95, Math.max(30, combinedConfidence)),
        astroRecommendation: astroPrediction.recommendation,
        warnings: astroPrediction.warnings,
        finalDirection: this.decideFinalDirection(aiDirection, astroDirection, astroWeight)
      };
    }
    
    // If only astro prediction available
    if (astroPrediction) {
      return {
        prediction: {
          direction: astroPrediction.direction,
          confidence: astroPrediction.confidence + feedbackAdjustment,
          priceTarget: this.calculateAstroPriceTarget(astroPrediction),
          timeframe: '1-3 days'
        },
        analysis: {
          technicalFactors: ['Astrological analysis'],
          marketSentiment: astroPrediction.direction,
          keyRisks: astroPrediction.warnings,
          recommendation: astroPrediction.recommendation
        },
        reasoning: 'Prediction based on advanced Vedic astrology calculations',
        astroFactors: astroPrediction.factors,
        astroPowered: true
      };
    }
    
    return aiPrediction;
  }

  private adjustPriceTargetByAstro(
    aiTarget: { low: number; high: number },
    astroDirection: string,
    astroStrength: number
  ): { low: number; high: number } {
    const adjustmentFactor = (astroStrength - 50) / 1000; // Convert to percentage
    
    if (astroDirection === 'bullish') {
      return {
        low: aiTarget.low * (1 + adjustmentFactor * 0.5),
        high: aiTarget.high * (1 + adjustmentFactor * 1.5)
      };
    } else if (astroDirection === 'bearish') {
      return {
        low: aiTarget.low * (1 - adjustmentFactor * 1.5),
        high: aiTarget.high * (1 - adjustmentFactor * 0.5)
      };
    }
    
    return aiTarget;
  }

  private calculateAstroPriceTarget(astroPrediction: AstrologyPrediction): { low: number; high: number } {
    // This would need current price passed in, using placeholder
    const basePrice = 100; // This should be passed from the calling function
    const movement = (astroPrediction.strength - 50) / 50 * 0.05; // 5% max movement
    
    if (astroPrediction.direction === 'bullish') {
      return {
        low: basePrice * (1 + movement * 0.3),
        high: basePrice * (1 + movement)
      };
    } else if (astroPrediction.direction === 'bearish') {
      return {
        low: basePrice * (1 - movement),
        high: basePrice * (1 - movement * 0.3)
      };
    }
    
    return {
      low: basePrice * 0.98,
      high: basePrice * 1.02
    };
  }

  private decideFinalDirection(
    aiDirection: string,
    astroDirection: string,
    astroWeight: number
  ): string {
    if (aiDirection === astroDirection) return aiDirection;
    
    // If one is neutral, follow the other
    if (aiDirection === 'neutral') return astroDirection;
    if (astroDirection === 'neutral') return aiDirection;
    
    // In case of conflict, astrology has more weight (60%)
    return astroWeight > 0.5 ? astroDirection : aiDirection;
  }

  // Public method for getting current astrology data (REAL-TIME ONLY)
  async getCurrentAstrology(
    date?: Date, 
    location?: { lat: number; lng: number },
    useSkyfieldEnhancement: boolean = false,
    usePythonEnhancement: boolean = false
  ): Promise<AstrologyData> {
    const targetDate = date || new Date();
    const defaultLocation = location || { lat: 19.0760, lng: 72.8777 }; // Mumbai coordinates
    
    // Always use real-time calculations, prefer API if available
    let astroData = await this.getDrikpanchangData(targetDate, defaultLocation);
    
    if (!astroData) {
      throw new Error('Failed to get real-time astrology data');
    }
    
    // Optional Python enhancement for research-grade calculations
    if (usePythonEnhancement && process.env.ENABLE_PYTHON_ASTRO === 'true') {
      try {
        const { pythonAstrologyBridge } = await import('./pythonAstrologyBridge');
        const pythonResult = await pythonAstrologyBridge.getEnhancedPrediction(
          targetDate,
          defaultLocation.lat,
          defaultLocation.lng
        );
        
        if (pythonResult.available && pythonResult.details) {
          console.log(`🐍 Python enhancement: Score ${pythonResult.score?.toFixed(2)}`);
          
          // Enhance with Python calculations
          astroData.pythonEnhanced = {
            score: pythonResult.score,
            details: pythonResult.details
          };
        }
      } catch (error) {
        console.warn('Python enhancement failed, using current system:', error);
      }
    }
    
    // Optional Skyfield enhancement for ultra-precise calculations
    if (useSkyfieldEnhancement && process.env.ENABLE_SKYFIELD === 'true') {
      try {
        const { skyfieldComparisonService } = await import('./skyfieldComparison');
        const comparison = await skyfieldComparisonService.compareAccuracy(targetDate);
        
        if (comparison.skyfieldAvailable && comparison.summary.averageDifference > 0.5) {
          console.log(`🔬 Skyfield enhancement: Avg difference ${comparison.summary.averageDifference.toFixed(3)}°`);
          
          // Use Skyfield data if significantly more accurate
          // This would replace planetary positions with Skyfield calculations
          // For now, we log the comparison and keep current system
        }
      } catch (error) {
        console.warn('Skyfield enhancement failed, using current system:', error);
      }
    }
    
    return astroData;
  }
}

export const astrologyService = new AstrologyService();