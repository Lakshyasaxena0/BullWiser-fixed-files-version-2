# Overview

BullWiser is an advanced AI-powered stock prediction platform built as a full-stack web application. The system provides real-time market analysis from NSE and BSE exchanges, personalized trading insights with hidden astrology bias, and comprehensive portfolio management. It features a React-based frontend with a shadcn/ui component library, an Express.js backend with TypeScript, and PostgreSQL database integration using Drizzle ORM. The application includes subscription management, custom username/password authentication, real-time stock data integration, enhanced prediction algorithms with astrology influence, feedback systems, and training status monitoring.

## Recent Updates (Aug 2025)
- **Custom Authentication System**: Replaced Replit Auth with username/password authentication
- **Registration with Password Confirmation**: Users must enter password twice for security
- **Secure Password Storage**: Using Scrypt hashing with salt for password security
- **NSE/BSE API Integration**: Implemented real-time stock data from National Stock Exchange and Bombay Stock Exchange using the stock-nse-india library
- **Real AI Integration**: Integrated OpenAI GPT-4o for genuine AI-powered stock analysis with OPENAI_API_KEY configured
- **Privacy-First Astrology**: Astrology calculations run in background but details are hidden from users (developer-only)
- **Real-Time Astronomical Calculations**: No mock data - all astrology uses real ephemeris calculations
- **AI Training on Astrological Charts**: AI now reads and interprets D1, D9, D10 divisional charts with transits and Dasha periods
- **Sector-Specific Planetary Mappings**: Each stock sector (IT, Banking, Pharma, etc.) has unique planetary rulers and zodiac associations
- **Real-World Training System**: Capability to train on actual market outcomes to improve prediction accuracy
- **Enhanced Astrology Module**: Advanced Vedic astrology system with comprehensive calculations including:
  - Hora (planetary hours) system
  - Tithi, Nakshatra, Yoga, and Karana calculations
  - Planetary positions and retrograde analysis
  - Muhurat windows (auspicious trading times)
  - Rahu Kalam, Gulika Kalam, and Yamghanta Kalam timing warnings
  - Drikpanchang API integration support (optional, with DRIKPANCHANG_API_KEY)
- **AI + Astrology Combined Predictions**: Unified prediction system where:
  - Astrology has 60% weight, AI has 40% weight
  - When predictions disagree, astrology takes precedence
  - Confidence scores combine both sources
- **Feedback Learning System**: 
  - Records user feedback on prediction accuracy
  - Learns from historical performance
  - Adjusts confidence scores based on past accuracy
  - Provides personalized predictions based on user history
  - Tracks performance by stock, time of day, and prediction method
- **Real-time Market Data**: Replaced mock data with live market indices, stock quotes, and historical data
- **Enhanced Prediction Engine**: Combines AI analysis, astrology calculations, and feedback learning
- **Multi-exchange Support**: Users can get quotes from both NSE and BSE exchanges
- **Statistical Tools Display**: Shows both technical indicators and astrological factors with their weightages
- **Clickable Active Predictions**: Active predictions card navigates to full predictions history page
- **Predictions History Page**: Tabbed interface separating Active and Past predictions with detailed stats
- **Progressive Web App (PWA)**: Added mobile app capabilities with offline support and installable app features
- **Push Notifications**: Implemented web push notifications for price alerts and predictions
- **Mobile-Responsive Design**: Dedicated mobile interface with bottom navigation and optimized layouts
- **Service Worker**: Added caching and background sync for better mobile performance

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development/build tooling
- **UI Components**: shadcn/ui component library based on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and Inter font family
- **Routing**: Wouter for client-side routing with protected routes
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers

## Backend Architecture  
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful API with JSON responses
- **Session Management**: Express session with PostgreSQL session store
- **Error Handling**: Centralized error handling middleware with status codes
- **Development**: Hot reload with tsx and Vite integration

## Data Layer
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM with migrations support
- **Schema**: Centralized schema definition in shared directory
- **Tables**: Users, subscriptions, predictions, watchlist, feedback, training status, and sessions

## Authentication & Authorization
- **Provider**: Custom username/password authentication
- **Strategy**: Passport.js with Local Strategy
- **Password Security**: Scrypt hashing with salt
- **Sessions**: Server-side sessions with PostgreSQL storage
- **Registration**: Username, password (with confirmation), email, and name fields
- **Protection**: Route-level authentication checks with automatic redirects

## Key Features
- **Real-time Stock Data**: Live NSE/BSE market data integration with stock-nse-india library
- **AI-Powered Analysis**: Integration with OpenAI GPT-4o for intelligent stock analysis and predictions
- **Privacy-First Astrology System**: Comprehensive Vedic astrology calculations with 60% weight in predictions (hidden from users):
  - Hora (planetary hours) with ruling planet influence
  - Tithi, Nakshatra, Yoga, and Karana calculations
  - Real-time planetary positions and retrograde analysis
  - Muhurat windows for auspicious trading times
  - Inauspicious period warnings (Rahu Kalam, Gulika Kalam, Yamghanta Kalam)
- **Combined AI + Astrology Predictions**: Unified system where astrology overrides AI when they disagree
- **Feedback Learning System**: Machine learning from user feedback to improve prediction accuracy
- **Personalized Predictions**: User-specific adjustments based on historical performance
- **Multi-exchange Support**: Real-time quotes from both National Stock Exchange and Bombay Stock Exchange
- **Subscription System**: Tiered subscription plans with usage tracking
- **Watchlist Management**: Personal stock watchlist with CRUD operations
- **Training Simulation**: AI model training status with progress tracking
- **Market Overview**: Live market indices, top gainers/losers, and most active stocks
- **Historical Data**: Access to historical stock data with astrology bias applied
- **Stock Search**: Search functionality across NSE stock symbols
- **Progressive Web App**: Installable mobile app with offline capabilities
- **Push Notifications**: Real-time alerts for price targets and predictions
- **Mobile Interface**: Dedicated mobile UI with bottom navigation and optimized components
- **Service Worker**: Background sync and caching for improved performance

## API Endpoints

### Market Data Endpoints
- `GET /api/market/overview` - Live market indices and top stocks from NSE/BSE
- `GET /api/stock/:symbol` - Real-time stock quote with astrology bias
- `GET /api/stock/:symbol/history?days=30` - Historical data with astrology influence
- `GET /api/search/stocks?q=query` - Search NSE stock symbols

### Prediction Endpoints
- `POST /api/predict` - Combined AI + Astrology + Feedback-enhanced predictions
  - Uses OpenAI GPT-4o when OPENAI_API_KEY is configured
  - Applies advanced Vedic astrology calculations
  - Adjusts based on user feedback history
  - Returns combined confidence scores
- `POST /api/forecast` - Multi-horizon forecasts with astrology influence

### Feedback & Learning Endpoints
- `POST /api/feedback` - Record user feedback on prediction accuracy
  - Required: predictionId, actualPrice, actualDirection, wasUseful
  - Optional: notes
- `GET /api/feedback/metrics/:symbol` - Get stock-specific performance metrics
- `GET /api/feedback/personalization` - Get user's personalized prediction adjustments

### Astrology Endpoints
- `GET /api/astrology/current` - Get current astrological data
  - Optional: lat, lng for location-specific calculations
  - Returns: Hora, Tithi, Nakshatra, planetary positions, muhurat windows

### System Architecture Details
- **AI Integration**: OpenAI GPT-4o for technical analysis (40% weight)
- **Astrology System**: Advanced Vedic calculations (60% weight)
- **Chart Reading AI**: Trained to interpret D1, D9, D10 divisional charts
- **Sector Mappings**: Planetary rulers for each stock sector (IT, Banking, Pharma, etc.)
- **Training System**: Real-world case learning for continuous improvement
  - Hora (planetary hours) system
  - 27 Nakshatras with quality scores
  - Planetary positions and retrograde analysis
  - Muhurat windows for auspicious trading
  - Inauspicious period warnings
- **Feedback Learning**: 
  - Stores prediction outcomes
  - Adjusts confidence based on historical accuracy
  - Provides user-specific personalization
- **Combined Prediction Flow**:
  1. Get real-time stock data from NSE/BSE
  2. Generate AI prediction (if OpenAI configured)
  3. Calculate astrology prediction
  4. Combine with astrology having precedence
  5. Apply feedback learning adjustments
  6. Return enhanced prediction with metadata

## File Structure
- `/client` - React frontend application
- `/server` - Express.js backend API
- `/server/stockDataService.ts` - NSE/BSE API integration with astrology bias
- `/shared` - Shared TypeScript schemas and types
- `/components.json` - shadcn/ui configuration
- `/drizzle.config.ts` - Database configuration
- `/vite.config.ts` - Frontend build configuration

# External Dependencies

## Core Dependencies
- **Database**: PostgreSQL via Neon serverless (@neondatabase/serverless)
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Custom Passport.js Local Strategy with Scrypt password hashing
- **Session Storage**: connect-pg-simple for PostgreSQL session management
- **Stock Data**: stock-nse-india library for NSE real-time data integration
- **Date Utilities**: date-fns for astrology hora calculations

## Frontend Libraries
- **UI Framework**: React with TypeScript
- **Component Library**: Radix UI primitives via shadcn/ui
- **Icons**: Lucide React and Font Awesome
- **Styling**: Tailwind CSS with PostCSS
- **Charts**: recharts for data visualization
- **HTTP Client**: Fetch API with TanStack Query

## Development Tools
- **Build Tool**: Vite with React plugin
- **Runtime**: tsx for TypeScript execution
- **Bundler**: esbuild for production builds
- **Linting**: TypeScript compiler for type checking
- **Development**: Replit-specific plugins for error handling and cartographer

## Payment Integration
- **Stripe**: React Stripe.js for subscription payment processing

## Additional Services
- **WebSocket**: ws library for Neon database connections
- **Utilities**: date-fns for date manipulation
- **Validation**: Zod for runtime type validation
- **Caching**: Memoizee for function result caching