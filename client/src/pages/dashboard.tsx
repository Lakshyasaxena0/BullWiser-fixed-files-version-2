import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { isUnauthorizedError } from "@/lib/authUtils";

import StatsCards from "@/components/dashboard/stats-cards";
import MarketOverview from "@/components/dashboard/market-overview";
import Charts from "@/components/dashboard/charts";
import ActivityFeed from "@/components/dashboard/activity-feed";
import TrainingStatus from "@/components/dashboard/training-status";
import StockRatePanel from "@/components/dashboard/stock-rate-panel";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: marketData } = useQuery({
    queryKey: ["/api/market/overview"],
    enabled: isAuthenticated,
  });

  const { data: activePredictions } = useQuery({
    queryKey: ["/api/user/predictions/active"],
    enabled: isAuthenticated,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["/api/user/subscriptions"],
    enabled: isAuthenticated,
  });

  const { data: cryptoOverview } = useQuery({
    queryKey: ["/api/crypto/overview"],
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      <StatsCards 
        activePredictions={activePredictions?.length || 0}
        subscriptions={subscriptions}
      />

      {/* Market Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <MarketOverview marketData={marketData} />
        </div>
        <div>
          <StockRatePanel />
        </div>
      </div>

      {/* Charts and Analytics */}
      <Charts />

      {/* Trending Cryptocurrencies */}
      {cryptoOverview && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Trending Cryptocurrencies</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/cryptocurrencies')}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              View All
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Top Gainers</h4>
              <div className="space-y-2">
                {cryptoOverview.topGainers?.slice(0, 3).map((crypto: any) => (
                  <div key={crypto.symbol} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{crypto.symbol}</span>
                    <span className="text-green-600">+{crypto.changePercent24h.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Most Active</h4>
              <div className="space-y-2">
                {cryptoOverview.mostActive?.slice(0, 3).map((crypto: any) => (
                  <div key={crypto.symbol} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{crypto.symbol}</span>
                    <span className="text-blue-600">${(crypto.volume24h / 1e9).toFixed(1)}B</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Market Cap</h4>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-gray-600">Total: </span>
                  <span className="font-medium">${(cryptoOverview.totalMarketCap / 1e12).toFixed(2)}T</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">24h Change: </span>
                  <span className={`font-medium ${cryptoOverview.marketCapChange24h > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {cryptoOverview.marketCapChange24h > 0 ? '+' : ''}{cryptoOverview.marketCapChange24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
        <div className="space-y-6">
          <div className="bg-gray-100 border border-gray-200 rounded-xl p-6 text-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Premium Plan</h3>
              <i className="fas fa-crown text-xl text-yellow-500"></i>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Usage</span>
                <span className="font-semibold text-gray-900">{activePredictions?.length || 0}/200</span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-2">
                <div 
                  className="bg-gray-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(((activePredictions?.length || 0) / 200) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Renewal</span>
                <span className="font-semibold text-gray-900">Dec 25, 2024</span>
              </div>
            </div>
            <button 
              onClick={() => setLocation('/plans')}
              className="w-full bg-white text-primary font-semibold py-2 px-4 rounded-lg mt-4 hover:bg-gray-100 transition-colors duration-200"
              data-testid="button-manage-plan"
            >
              Manage Plan
            </button>
          </div>
          <TrainingStatus />
        </div>
      </div>

      {/* Subscribe Prompt at Bottom (if no subscription) */}
      {(!subscriptions || subscriptions.length === 0) && (
        <div className="bg-gradient-to-r from-blue-100 to-blue-200 border border-blue-300 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div className="text-left">
              <h4 className="font-semibold text-blue-900 text-sm">Subscribe to Start Predicting</h4>
              <p className="text-blue-700 text-xs">Get AI-powered stock predictions with real-time data</p>
            </div>
            <button 
              onClick={() => setLocation('/plans')}
              className="bg-blue-600 text-white font-medium py-2 px-4 rounded-lg text-sm hover:bg-blue-700 transition-colors duration-200 ml-auto"
            >
              Choose Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}