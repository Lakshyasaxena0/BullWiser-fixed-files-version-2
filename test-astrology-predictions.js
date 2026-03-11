// Test script for astrology-based predictions
// Run with: node test-astrology-predictions.js

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';

// Test credentials
const testUser = {
  username: 'testuser',
  // Bug 33 fix: was 'Test123!@#' — correct password per APPLICATION_STATUS.md is 'password123'.
  password: 'password123'
};

async function registerUser() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password,
        confirmPassword: testUser.password,
        email: 'test@example.com',
        // Bug 35 fix: server registration expects a single 'name' field, not firstName/lastName.
        // replit.md (line 77) documents registration fields as: username, password, email, name.
        name: 'Test User'
      })
    });

    if (response.ok) {
      console.log('✓ User registered successfully');
    } else {
      const error = await response.json();
      console.log('User might already exist:', error.message);
    }
  } catch (error) {
    console.error('Registration error:', error);
  }
}

async function loginUser() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username,
        password: testUser.password
      })
    });

    if (response.ok) {
      // Bug 34 fix: response.headers.raw() was removed in node-fetch v3 — it throws
      // TypeError: response.headers.raw is not a function on every call.
      // Replacement: getSetCookie() returns the Set-Cookie values as a string[].
      // We then strip the cookie attributes (Path, HttpOnly, etc.) and join with '; '
      // so the result is a valid Cookie: request header.
      const setCookies = response.headers.getSetCookie();
      const cookieString = setCookies
        .map(c => c.split(';')[0])
        .join('; ');
      console.log('✓ Logged in successfully');
      return cookieString;
    } else {
      throw new Error('Login failed with status ' + response.status);
    }
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

async function getCurrentAstrology() {
  console.log('\n📊 CURRENT ASTROLOGICAL DATA');
  console.log('='.repeat(50));

  try {
    const response = await fetch(`${API_BASE}/api/astrology/current`);

    // Bug 36 fix: response.json() was called unconditionally (line 71 in original).
    // If the server returns a non-JSON error page, that throws SyntaxError.
    // Check response.ok first.
    if (!response.ok) {
      console.error('Astrology endpoint returned', response.status);
      return null;
    }
    const data = await response.json();

    console.log(`🌟 Current Hora: ${data.hora}`);
    console.log(`🌙 Lunar Phase: ${data.lunarPhase} (${Math.round(data.lunarIllumination)}% illuminated)`);
    console.log(`📿 Tithi: ${data.tithi}`);
    console.log(`⭐ Nakshatra: ${data.nakshatra}`);
    console.log(`🕉️ Yoga: ${data.yoga}`);
    console.log(`📅 Karana: ${data.karana}`);

    console.log('\n⏰ Muhurat Windows:');
    // Bug 37 fix: muhuratWindows could be absent if astrology calculation fails.
    // Guard with || [] before forEach.
    // Bug 38 fix: forEach parameter was named 'window', which shadows the browser global.
    // Renamed to 'muhurat'.
    (data.muhuratWindows || []).forEach(muhurat => {
      const quality = muhurat.quality === 'excellent' ? '🌟' :
                      muhurat.quality === 'good' ? '✨' :
                      muhurat.quality === 'average' ? '☀️' : '⚠️';
      console.log(`  ${quality} ${muhurat.start} - ${muhurat.end} (${muhurat.quality})`);
    });

    console.log('\n⚠️ Inauspicious Periods:');
    console.log(`  🔴 Rahu Kalam: ${data.rahuKalamStart} - ${data.rahuKalamEnd}`);
    console.log(`  🟠 Gulika Kalam: ${data.gulikaKalamStart} - ${data.gulikaKalamEnd}`);
    console.log(`  🟡 Yamghanta Kalam: ${data.yamghantaKalamStart} - ${data.yamghantaKalamEnd}`);

    console.log('\n🪐 Planetary Positions:');
    // Bug 37 fix: planetaryPositions could be absent; guard with || [].
    (data.planetaryPositions || []).slice(0, 5).forEach(planet => {
      const retrograde = planet.retrograde ? ' (R)' : '';
      // Guard: planet.degree may be a string from the server; Number() ensures .toFixed() works.
      console.log(`  ${planet.planet}: ${planet.sign} at ${Number(planet.degree).toFixed(1)}°${retrograde}`);
    });

    return data;
  } catch (error) {
    console.error('Error fetching astrology data:', error);
    return null;
  }
}

async function getStockPrediction(stock, cookie) {
  console.log(`\n💹 PREDICTION FOR ${stock}`);
  console.log('='.repeat(50));

  try {
    const response = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        stock: stock,
        when: 'now',
        mode: 'astro-enhanced',
        riskLevel: 'medium'
      })
    });

    // Fix: response.json() must only be called after confirming the response
    // is likely JSON. Calling it unconditionally throws SyntaxError when the
    // server returns an HTML error page (e.g. 401, 500).
    if (response.ok) {
      const data = await response.json();
      console.log(`📈 Stock: ${data.stock}`);
      console.log(`💵 Current Price: ₹${data.currentPrice}`);
      console.log(`📊 Prediction Range: ₹${data.predLow} - ₹${data.predHigh}`);
      console.log(`🎯 Confidence: ${data.confidence}%`);
      console.log(`🔮 Direction: ${data.direction}`);

      if (data.astroFactors) {
        console.log('\n🌟 Astrological Factors:');
        console.log(`  Hora Score: ${data.astroFactors.hora}/100`);
        console.log(`  Tithi Score: ${data.astroFactors.tithi}/100`);
        console.log(`  Nakshatra Score: ${data.astroFactors.nakshatra}/100`);
        console.log(`  Planetary Score: ${data.astroFactors.planetary}/100`);
        console.log(`  Muhurat Score: ${data.astroFactors.muhurat}/100`);
        console.log(`  Rahu-Ketu Score: ${data.astroFactors.rahuKetu}/100`);
      }

      if (data.astroStrength) {
        console.log(`\n🔮 Overall Astrology Strength: ${data.astroStrength}/100`);
      }

      console.log(`\n📝 Recommendation: ${data.recommendation}`);

      if (data.keyRisks && data.keyRisks.length > 0) {
        console.log('\n⚠️ Warnings:');
        data.keyRisks.forEach(risk => console.log(`  • ${risk}`));
      }

      if (data.sources) {
        console.log('\n📊 Prediction Sources:');
        Object.entries(data.sources).forEach(([key, value]) => {
          console.log(`  • ${key}: ${value}`);
        });
      }

      return data;
    } else {
      // Log the status code; attempt to parse JSON body for detail but don't crash.
      let errorDetail = '';
      try {
        const errBody = await response.json();
        errorDetail = JSON.stringify(errBody);
      } catch (_) {
        errorDetail = `HTTP ${response.status}`;
      }
      console.error('Prediction failed:', errorDetail);
      return null;
    }
  } catch (error) {
    console.error('Error getting prediction:', error);
    return null;
  }
}

async function testMultipleStocks(cookie) {
  const stocks = ['TCS', 'INFY', 'RELIANCE', 'HDFCBANK', 'ICICIBANK'];

  console.log('\n\n🔄 TESTING MULTIPLE STOCKS');
  console.log('='.repeat(50));

  for (const stock of stocks) {
    await getStockPrediction(stock, cookie);
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function compareTimeBasedPredictions(stock, cookie) {
  console.log(`\n\n⏳ TIME-BASED PREDICTION COMPARISON FOR ${stock}`);
  console.log('='.repeat(50));

  const times = [
    { when: 'now', label: 'Current Time' },
    { when: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), label: '3 Hours Later' },
    { when: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), label: 'Tomorrow' }
  ];

  for (const time of times) {
    console.log(`\n📅 ${time.label}:`);

    try {
      const response = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookie
        },
        body: JSON.stringify({
          stock: stock,
          when: time.when,
          mode: 'astro-enhanced',
          riskLevel: 'medium'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`  Confidence: ${data.confidence}%`);
        console.log(`  Direction: ${data.direction}`);
        console.log(`  Hora: ${data.horaInfluence || 'N/A'}`);
        console.log(`  Astro Bias: ${data.astrologyBias || 0}`);
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function main() {
  console.log('🚀 BullWiser Astrology-Based Prediction Test');
  console.log('='.repeat(50));

  // Register user if needed
  await registerUser();

  // Login
  const cookie = await loginUser();
  if (!cookie) {
    console.error('❌ Failed to login. Please check credentials.');
    // Bug 40 fix: was `return` which exits with code 0 (CI treats as success).
    // Use process.exit(1) so CI/CD pipelines correctly detect the failure.
    process.exit(1);
  }

  // Get current astrological data
  await getCurrentAstrology();

  // Test single stock prediction
  await getStockPrediction('TCS', cookie);

  // Test multiple stocks
  await testMultipleStocks(cookie);

  // Compare predictions at different times
  await compareTimeBasedPredictions('RELIANCE', cookie);

  console.log('\n\n✅ Test completed!');
  console.log('Note: AI predictions will be enhanced when OPENAI_API_KEY is configured.');
  // Bug 39 fix: original comment incorrectly said "100% astrology weight" as if always true.
  // The actual architecture is 60% astrology + 40% AI. Without OPENAI_API_KEY the system
  // falls back to 100% astrology only.
  console.log('Without OPENAI_API_KEY the system falls back to 100% astrology-based predictions.');
}

// Run the test
main().catch(console.error);
