// ─────────────────────────────────────────────────────────────────────────────
// astrologyService.ts  —  Real-time Vedic astrology via Prokerala API
// ─────────────────────────────────────────────────────────────────────────────

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
  source?: 'prokerala' | 'calculated';
}

interface AstrologyPrediction {
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  confidence: number;
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

// ─── Prokerala token cache ────────────────────────────────────────────────────
let prokeralaToken: string | null = null;
let tokenExpiry: number = 0;

async function getProkeralaToken(): Promise<string | null> {
  if (!process.env.PROKERALA_CLIENT_ID || !process.env.PROKERALA_CLIENT_SECRET) return null;
  if (prokeralaToken && Date.now() < tokenExpiry) return prokeralaToken;

  try {
    const res = await fetch('https://api.prokerala.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.PROKERALA_CLIENT_ID,
        client_secret: process.env.PROKERALA_CLIENT_SECRET,
      }),
    });
    if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
    const data = await res.json();
    prokeralaToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    console.log('[Astro] Prokerala token obtained ✅');
    return prokeralaToken;
  } catch (err) {
    console.error('[Astro] Prokerala token error:', err);
    return null;
  }
}

// ─── Per-endpoint response cache (1 minute TTL) ───────────────────────────────
// Key format: "<endpoint>|<datetime>|<coordinates>"
// Each of the 4 endpoints (panchang, planet-position, hora, inauspicious-period)
// gets its own cache entry so identical calls within 1 minute skip the API call.
const PROKERALA_CACHE_TTL = 60 * 1000; // 1 minute in milliseconds
const prokeralaCache = new Map<string, { data: any; cachedAt: number }>();

function makeProkeralaCacheKey(endpoint: string, params: Record<string, string>): string {
  // Key = endpoint + datetime (rounded to minute) + coordinates
  // Rounding datetime to the minute means calls within the same minute share a cache entry
  const dt = params.datetime ? params.datetime.substring(0, 16) : ''; // "2026-03-22T14:30"
  const coords = params.coordinates || '';
  return `${endpoint}|${dt}|${coords}`;
}

async function prokeralaGet(endpoint: string, params: Record<string, string>): Promise<any> {
  // ── Check cache first ──────────────────────────────────────────────────────
  const cacheKey = makeProkeralaCacheKey(endpoint, params);
  const cached   = prokeralaCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < PROKERALA_CACHE_TTL) {
    console.log(`[Astro] Cache hit for ${endpoint} (${Math.round((Date.now() - cached.cachedAt) / 1000)}s old)`);
    return cached.data;
  }

  // ── Cache miss — fetch from Prokerala ─────────────────────────────────────
  const token = await getProkeralaToken();
  if (!token) return null;

  const url = new URL(`https://api.prokerala.com/v2/astrology/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`[Astro] Prokerala ${endpoint} failed: ${res.status}`);
      return null;
    }
    const json = await res.json();
    const data = json.data || json;

    // ── Store in cache ────────────────────────────────────────────────────────
    prokeralaCache.set(cacheKey, { data, cachedAt: Date.now() });
    console.log(`[Astro] Cached ${endpoint} response (TTL: 1 min)`);

    return data;
  } catch (err) {
    console.error(`[Astro] Prokerala ${endpoint} error:`, err);
    return null;
  }
}

function prokeralaDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}+05:30`
  );
}

export class AstrologyService {
  private readonly DEFAULT_LAT = 19.0760;
  private readonly DEFAULT_LNG = 72.8777;

  private readonly planetaryStrengths: Record<string, { bullish: number; volatility: number }> = {
    Sun:     { bullish: 0.7, volatility: 0.3 },
    Moon:    { bullish: 0.5, volatility: 0.8 },
    Mars:    { bullish: 0.6, volatility: 0.9 },
    Mercury: { bullish: 0.6, volatility: 0.4 },
    Jupiter: { bullish: 0.9, volatility: 0.2 },
    Venus:   { bullish: 0.8, volatility: 0.3 },
    Saturn:  { bullish: 0.3, volatility: 0.6 },
    Rahu:    { bullish: 0.4, volatility: 0.95 },
    Ketu:    { bullish: 0.3, volatility: 0.9 },
  };

  private readonly nakshatraQualities: Record<string, number> = {
    Ashwini: 0.8, Bharani: 0.4, Krittika: 0.6, Rohini: 0.9,
    Mrigashira: 0.7, Ardra: 0.3, Punarvasu: 0.8, Pushya: 0.95,
    Ashlesha: 0.2, Magha: 0.7, 'Purva Phalguni': 0.6, 'Uttara Phalguni': 0.8,
    Hasta: 0.85, Chitra: 0.6, Swati: 0.7, Vishakha: 0.5,
    Anuradha: 0.8, Jyeshtha: 0.3, Mula: 0.2, 'Purva Ashadha': 0.6,
    'Uttara Ashadha': 0.8, Shravana: 0.9, Dhanishta: 0.7, Shatabhisha: 0.5,
    'Purva Bhadrapada': 0.4, 'Uttara Bhadrapada': 0.7, Revati: 0.85,
  };

  private readonly horaRulers = [
    'Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars',
    'Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars',
    'Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars',
    'Sun','Venus','Mercury',
  ];

  // ── Panchang ─────────────────────────────────────────────────────────────
  private async fetchProkeralaPanchang(date: Date, lat: number, lng: number): Promise<Partial<AstrologyData> | null> {
    const data = await prokeralaGet('panchang', {
      datetime: prokeralaDateTime(date),
      coordinates: `${lat},${lng}`,
      ayanamsa: '1',
    });
    if (!data) return null;
    try {
      return {
        tithi:     data.tithi?.details?.[0]?.name    || data.tithi?.name    || this.calcTithi(date),
        nakshatra: data.nakshatra?.details?.[0]?.name || data.nakshatra?.name || this.calcNakshatra(date),
        yoga:      data.yoga?.details?.[0]?.name     || data.yoga?.name     || 'Siddha',
        karana:    data.karana?.details?.[0]?.name   || data.karana?.name   || 'Bava',
        source: 'prokerala',
      };
    } catch { return null; }
  }

  // ── Planet positions ──────────────────────────────────────────────────────
  private async fetchProkeralaPlanets(date: Date, lat: number, lng: number): Promise<PlanetaryPosition[] | null> {
    const data = await prokeralaGet('planet-position', {
      datetime: prokeralaDateTime(date),
      coordinates: `${lat},${lng}`,
      ayanamsa: '1',
    });
    if (!data || !data.planet_position) return null;

    const signs = [
      'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
      'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
    ];
    try {
      return data.planet_position.map((p: any) => ({
        planet: p.name,
        sign: signs[p.rasi - 1] || signs[0],
        degree: parseFloat(p.degree) || 0,
        retrograde: p.isRetrograde === true || p.is_retrograde === true,
      }));
    } catch { return null; }
  }

  // ── Hora ──────────────────────────────────────────────────────────────────
  private async fetchProkeralaHora(date: Date, lat: number, lng: number): Promise<string | null> {
    const data = await prokeralaGet('hora', {
      datetime:    prokeralaDateTime(date),
      coordinates: `${lat},${lng}`,
      ayanamsa:    '1',
    });
    if (!data) return null;

    try {
      const now   = date.getTime();
      const horas: any[] = data.hora || data.horas || [];
      const current = horas.find((h: any) => {
        const start = new Date(h.start || h.startTime).getTime();
        const end   = new Date(h.end   || h.endTime).getTime();
        return now >= start && now <= end;
      });
      return current?.planet || current?.lord || null;
    } catch { return null; }
  }

  // ── Kalam (inauspicious periods) ──────────────────────────────────────────
  private async fetchProkeralaKalam(date: Date, lat: number, lng: number): Promise<Partial<AstrologyData> | null> {
    const data = await prokeralaGet('inauspicious-period', {
      datetime:    prokeralaDateTime(date),
      coordinates: `${lat},${lng}`,
      ayanamsa:    '1',
    });
    if (!data) return null;

    try {
      const fmt = (iso: string) => {
        if (!iso) return '';
        try { return new Date(iso).toTimeString().substring(0, 5); } catch { return ''; }
      };

      const periods: any[] = data.inauspicious_period || data.inauspiciousPeriod || [];
      const find = (name: string) => periods.find((p: any) =>
        (p.name || p.type || '').toLowerCase().includes(name.toLowerCase())
      );

      const rahu   = find('rahu');
      const gulika = find('gulika') || find('gulika kalam');
      const yam    = find('yamaganda') || find('yamghanta');

      return {
        rahuKalamStart:      fmt(rahu?.start   || rahu?.startTime   || ''),
        rahuKalamEnd:        fmt(rahu?.end     || rahu?.endTime     || ''),
        gulikaKalamStart:    fmt(gulika?.start || gulika?.startTime || ''),
        gulikaKalamEnd:      fmt(gulika?.end   || gulika?.endTime   || ''),
        yamghantaKalamStart: fmt(yam?.start    || yam?.startTime    || ''),
        yamghantaKalamEnd:   fmt(yam?.end      || yam?.endTime      || ''),
      };
    } catch { return null; }
  }

  // ── Main: get real-time astrology data ────────────────────────────────────
  async getCurrentAstrology(date?: Date, location?: { lat: number; lng: number }): Promise<AstrologyData> {
    const d   = date || new Date();
    const lat = location?.lat || this.DEFAULT_LAT;
    const lng = location?.lng || this.DEFAULT_LNG;

    const [panchang, planets, hora, kalam] = await Promise.all([
      this.fetchProkeralaPanchang(d, lat, lng),
      this.fetchProkeralaPlanets(d, lat, lng),
      this.fetchProkeralaHora(d, lat, lng),
      this.fetchProkeralaKalam(d, lat, lng),
    ]);

    const isReal = !!(panchang || planets || hora || kalam);
    if (isReal) console.log('[Astro] Using real Prokerala data ✅');
    else        console.log('[Astro] Prokerala unavailable, using calculated fallback');

    return {
      hora:               hora || this.calcHora(d),
      tithi:              panchang?.tithi     || this.calcTithi(d),
      nakshatra:          panchang?.nakshatra || this.calcNakshatra(d),
      yoga:               panchang?.yoga      || this.calcYoga(d),
      karana:             panchang?.karana    || this.calcKarana(d),
      lunarPhase:         this.calcLunarPhase(d),
      lunarIllumination:  this.calcLunarIllumination(d),
      planetaryPositions: planets || this.calcPlanetPositions(d),
      muhuratWindows:     this.calcMuhuratWindows(d),
      rahuKalamStart:     kalam?.rahuKalamStart    || this.calcRahuKalam(d).start,
      rahuKalamEnd:       kalam?.rahuKalamEnd      || this.calcRahuKalam(d).end,
      gulikaKalamStart:   kalam?.gulikaKalamStart  || this.calcGulikaKalam(d).start,
      gulikaKalamEnd:     kalam?.gulikaKalamEnd    || this.calcGulikaKalam(d).end,
      yamghantaKalamStart: kalam?.yamghantaKalamStart || this.calcYamghantaKalam(d).start,
      yamghantaKalamEnd:   kalam?.yamghantaKalamEnd   || this.calcYamghantaKalam(d).end,
      source: isReal ? 'prokerala' : 'calculated',
    };
  }

  async getDrikpanchangData(date: Date, location?: { lat: number; lng: number }): Promise<AstrologyData | null> {
    return this.getCurrentAstrology(date, location);
  }

  // ── Prediction engine ─────────────────────────────────────────────────────
  async generateAstroPrediction(symbol: string, date: Date, currentPrice: number): Promise<AstrologyPrediction> {
    const astroData      = await this.getCurrentAstrology(date);
    const horaScore      = this.calcHoraScore(astroData.hora, symbol);
    const tithiScore     = this.calcTithiScore(astroData.tithi);
    const nakshatraScore = this.calcNakshatraScore(astroData.nakshatra);
    const planetaryScore = this.calcPlanetaryScore(astroData.planetaryPositions);
    const muhuratScore   = this.calcMuhuratScore(astroData.muhuratWindows, date);
    const rahuKetuScore  = this.calcRahuKetuScore(astroData, date);

    const total =
      horaScore * 0.25 + tithiScore * 0.15 + nakshatraScore * 0.20 +
      planetaryScore * 0.20 + muhuratScore * 0.10 + rahuKetuScore * 0.10;

    const direction: 'bullish' | 'bearish' | 'neutral' =
      total > 65 ? 'bullish' : total < 35 ? 'bearish' : 'neutral';
    const confidence    = Math.min(95, Math.max(40, Math.abs(total - 50) * 2 + this.astroBonus(astroData)));
    const warnings      = this.buildWarnings(astroData, date);
    const recommendation = this.buildRecommendation(direction, total, astroData, warnings);

    return {
      direction, strength: total, confidence,
      factors: { hora: horaScore, tithi: tithiScore, nakshatra: nakshatraScore, planetary: planetaryScore, muhurat: muhuratScore, rahuKetu: rahuKetuScore },
      recommendation, warnings,
    };
  }

  combineAIAndAstroPredictions(aiPrediction: any, astroPrediction: AstrologyPrediction, feedbackAdjustment = 0, currentPrice = 0): any {
    if (!aiPrediction) {
      return {
        prediction: {
          direction:  astroPrediction.direction,
          confidence: astroPrediction.confidence,
          priceTarget: {
            low:  currentPrice > 0 ? Math.round(currentPrice * 0.975 * 100) / 100 : 0,
            high: currentPrice > 0 ? Math.round(currentPrice * 1.025 * 100) / 100 : 0,
          },
        },
        combinedConfidence:  astroPrediction.confidence,
        finalDirection:      astroPrediction.direction,
        astroRecommendation: astroPrediction.recommendation,
        warnings:            astroPrediction.warnings,
        astroFactors:        astroPrediction.factors,
        metadata: { aiEnabled: false, feedbackLearningApplied: false },
      };
    }

    const aiDir    = aiPrediction.prediction?.direction || 'neutral';
    const astroDir = astroPrediction.direction;
    const opposite = (aiDir === 'bullish' && astroDir === 'bearish') || (aiDir === 'bearish' && astroDir === 'bullish');

    if (opposite) {
      return {
        ...aiPrediction,
        prediction:         { ...aiPrediction.prediction, direction: astroDir, confidence: astroPrediction.confidence },
        astroOverride:      true,
        astroFactors:       astroPrediction.factors,
        combinedConfidence: astroPrediction.confidence,
        finalDirection:     astroDir,
        recommendation:     astroPrediction.recommendation,
        warnings:           astroPrediction.warnings,
      };
    }

    const combined = Math.round(
      (aiPrediction.prediction?.confidence || 60) * 0.4 +
      astroPrediction.confidence * 0.6 +
      feedbackAdjustment
    );
    return {
      ...aiPrediction,
      astroFactors:        astroPrediction.factors,
      astroDirection:      astroDir,
      astroStrength:       astroPrediction.strength,
      combinedConfidence:  Math.min(95, Math.max(30, combined)),
      astroRecommendation: astroPrediction.recommendation,
      warnings:            astroPrediction.warnings,
      finalDirection:      aiDir === astroDir ? aiDir : astroDir,
    };
  }

  // ── Fallback calculators ──────────────────────────────────────────────────
  private calcHora(d: Date): string { return this.horaRulers[d.getHours()]; }
  private calcTithi(d: Date): string {
    const t = ['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima'];
    return t[(d.getDate() - 1) % 15];
  }
  private calcNakshatra(d: Date): string {
    const n = Object.keys(this.nakshatraQualities);
    const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
    return n[doy % 27];
  }
  private calcYoga(d: Date): string {
    const y = ['Vishkumbh','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyan','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
    return y[Math.floor((d.getHours() + d.getMinutes() / 60) * 27 / 24) % 27];
  }
  private calcKarana(d: Date): string {
    const k = ['Bava','Balava','Kaulava','Taitila','Gara','Vanija','Vishti','Shakuni','Chatushpada','Naga','Kimstughna'];
    return k[d.getDate() % 11];
  }
  private calcLunarPhase(d: Date): string {
    const day = d.getDate();
    if (day === 1 || day === 30) return 'New Moon';
    if (day === 15) return 'Full Moon';
    return day < 15 ? 'Waxing' : 'Waning';
  }
  private calcLunarIllumination(d: Date): number {
    const day = d.getDate();
    return day <= 15 ? (day / 15) * 100 : ((30 - day) / 15) * 100;
  }
  private calcPlanetPositions(d: Date): PlanetaryPosition[] {
    const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const T = (this.julianDay(d) - 2451545.0) / 36525.0;
    const base: Record<string, [number, number, number]> = {
      Sun:     [280.460, 36000.770, 0],
      Moon:    [218.316, 481267.881, 0],
      Mercury: [252.250, 149472.515, 6.28],
      Venus:   [181.979, 58517.816, 4.0],
      Mars:    [355.433, 19140.303, 2.5],
      Jupiter: [34.351,  3034.906, 1.2],
      Saturn:  [50.078,  1222.114, 0.8],
      Rahu:    [125.045, -1934.136, 0],
      Ketu:    [305.045,  1934.136, 0],
    };
    return Object.entries(base).map(([planet, [L0, L1, retro]]) => {
      const lon = ((L0 + L1 * T) % 360 + 360) % 360;
      return { planet, sign: signs[Math.floor(lon / 30)], degree: lon % 30, retrograde: retro > 0 && Math.sin(T * retro) < -0.7 };
    });
  }
  private julianDay(d: Date): number {
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate(), h = d.getHours() + d.getMinutes() / 60;
    const a = Math.floor((14 - m) / 12), yr = y + 4800 - a, mo = m + 12 * a - 3;
    return day + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045 + (h - 12) / 24;
  }
  private calcMuhuratWindows(_d: Date): MuhuratWindow[] {
    return [
      { start: '11:36', end: '12:24', quality: 'excellent' },
      { start: '06:00', end: '07:30', quality: 'good' },
      { start: '04:30', end: '06:00', quality: 'excellent' },
    ];
  }
  private calcRahuKalam(d: Date)     { return [{ start: '16:30', end: '18:00' }, { start: '07:30', end: '09:00' }, { start: '15:00', end: '16:30' }, { start: '12:00', end: '13:30' }, { start: '13:30', end: '15:00' }, { start: '10:30', end: '12:00' }, { start: '09:00', end: '10:30' }][d.getDay()]; }
  private calcGulikaKalam(d: Date)   { return [{ start: '15:00', end: '16:30' }, { start: '13:30', end: '15:00' }, { start: '12:00', end: '13:30' }, { start: '10:30', end: '12:00' }, { start: '09:00', end: '10:30' }, { start: '07:30', end: '09:00' }, { start: '06:00', end: '07:30' }][d.getDay()]; }
  private calcYamghantaKalam(d: Date){ return [{ start: '12:00', end: '13:30' }, { start: '10:30', end: '12:00' }, { start: '09:00', end: '10:30' }, { start: '07:30', end: '09:00' }, { start: '06:00', end: '07:30' }, { start: '15:00', end: '16:30' }, { start: '13:30', end: '15:00' }][d.getDay()]; }

  // ── Scoring ───────────────────────────────────────────────────────────────
  private calcHoraScore(hora: string, symbol: string): number {
    const s = this.planetaryStrengths[hora];
    if (!s) return 50;
    return Math.max(0, Math.min(100, s.bullish * 100 + (symbol.charCodeAt(0) % 20) - 10 - s.volatility * 10));
  }
  private calcTithiScore(tithi: string): number {
    const good = ['Dwitiya','Tritiya','Panchami','Saptami','Dashami','Ekadashi','Trayodashi'];
    const bad  = ['Chaturthi','Shashthi','Ashtami','Navami','Chaturdashi'];
    return good.includes(tithi) ? 75 : bad.includes(tithi) ? 25 : 50;
  }
  private calcNakshatraScore(n: string): number { return (this.nakshatraQualities[n] || 0.5) * 100; }
  private calcPlanetaryScore(pos: PlanetaryPosition[]): number {
    const exalt: Record<string,string> = { Sun:'Aries', Moon:'Taurus', Mars:'Capricorn', Mercury:'Virgo', Jupiter:'Cancer', Venus:'Pisces', Saturn:'Libra' };
    const debil: Record<string,string> = { Sun:'Libra', Moon:'Scorpio', Mars:'Cancer', Mercury:'Pisces', Jupiter:'Capricorn', Venus:'Virgo', Saturn:'Aries' };
    const scores = pos.map(p => {
      const s = this.planetaryStrengths[p.planet];
      if (!s) return 50;
      let sc = s.bullish * 100;
      if (p.retrograde)               sc = 100 - sc;
      if (exalt[p.planet] === p.sign) sc *= 1.2;
      if (debil[p.planet] === p.sign) sc *= 0.8;
      return sc;
    });
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
  }
  private calcMuhuratScore(windows: MuhuratWindow[], d: Date): number {
    const t = d.toTimeString().substring(0, 5);
    for (const w of windows) {
      if (this.inRange(t, w.start, w.end))
        return w.quality === 'excellent' ? 90 : w.quality === 'good' ? 70 : w.quality === 'average' ? 50 : 30;
    }
    return 50;
  }
  private calcRahuKetuScore(a: AstrologyData, d: Date): number {
    const t = d.toTimeString().substring(0, 5);
    if (this.inRange(t, a.rahuKalamStart, a.rahuKalamEnd))           return 20;
    if (this.inRange(t, a.gulikaKalamStart, a.gulikaKalamEnd))       return 25;
    if (this.inRange(t, a.yamghantaKalamStart, a.yamghantaKalamEnd)) return 30;
    return 50;
  }
  private inRange(cur: string, start: string, end: string): boolean {
    if (!cur || !start || !end) return false;
    const [ch, cm] = cur.split(':').map(Number);
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const c = ch * 60 + cm, s = sh * 60 + sm, e = eh * 60 + em;
    return c >= s && c <= e;
  }
  private astroBonus(a: AstrologyData): number {
    let b = 0;
    if (['Siddhi','Amrita','Shubha','Brahma','Indra'].includes(a.yoga)) b += 10;
    if (a.lunarPhase === 'Full Moon' || a.lunarPhase === 'New Moon')    b += 5;
    return b;
  }
  private buildWarnings(a: AstrologyData, d: Date): string[] {
    const t = d.toTimeString().substring(0, 5);
    const w: string[] = [];
    if (this.inRange(t, a.rahuKalamStart, a.rahuKalamEnd))     w.push('High volatility window — Rahu Kalam active');
    if (this.inRange(t, a.gulikaKalamStart, a.gulikaKalamEnd)) w.push('Proceed with caution — Gulika Kalam active');
    if (a.lunarPhase === 'New Moon')  w.push('New Moon — market sentiment may be suppressed');
    if (a.lunarPhase === 'Full Moon') w.push('Full Moon — expect heightened market emotions');
    const retro = a.planetaryPositions.filter(p => p.retrograde);
    if (retro.length > 3) w.push(`${retro.length} planets retrograde — expect reversals`);
    return w;
  }
  private buildRecommendation(dir: string, score: number, a: AstrologyData, warnings: string[]): string {
    let r = dir === 'bullish'
      ? score > 80 ? 'Strong buy signal — planetary alignment favorable for upward movement'
                  : 'Moderate buy — consider scaled entry with stop-loss'
      : dir === 'bearish'
      ? score < 20 ? 'Avoid new long positions — cosmic alignment unfavorable'
                   : 'Mild bearish — wait for better entry point'
      : 'Mixed signals — market may consolidate, monitor closely';
    const good = a.muhuratWindows.find(w => w.quality === 'excellent' || w.quality === 'good');
    if (good) r += `. Favorable trading window: ${good.start}–${good.end}`;
    return r;
  }
}

export const astrologyService = new AstrologyService();
