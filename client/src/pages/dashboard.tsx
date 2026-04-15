import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

import MarketOverview from "@/components/dashboard/market-overview";
import Charts from "@/components/dashboard/charts";
import ActivityFeed from "@/components/dashboard/activity-feed";
import TrainingStatus from "@/components/dashboard/training-status";
import TrendingStocks from "@/components/dashboard/trending-stocks";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: marketData } = useQuery({ queryKey: ["/api/market/overview"], enabled: isAuthenticated });
  const { data: activePredictions } = useQuery({ queryKey: ["/api/user/predictions/active"], enabled: isAuthenticated });
  const { data: subscriptions } = useQuery({ queryKey: ["/api/user/subscriptions"], enabled: isAuthenticated });
  const { data: cryptoOverview } = useQuery({ queryKey: ["/api/crypto/overview"], enabled: isAuthenticated, staleTime: 60000 });

  // Get active subscription for renewal date
  const activeSubscription = (subscriptions as any[])?.find((s: any) => new Date(s.endTs * 1000) > new Date());

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarketOverview marketData={marketData} />
        <TrendingStocks />
      </div>

      <Charts />

      {/* Trending Cryptocurrencies — Top 3 Gainers only */}
      {cryptoOverview && (cryptoOverview as any).topGainers?.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Trending Cryptocurrencies</h3>
            <Button variant="outline" size="sm" onClick={() => setLocation('/cryptocurrencies')} className="text-orange-600 border-orange-200 hover:bg-orange-50">
              View All
            </Button>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top 3 Gainers</p>
            {(cryptoOverview as any).topGainers?.slice(0, 3).map((crypto: any) => (
              <div key={crypto.symbol} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-orange-600">{crypto.symbol?.substring(0, 2)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{crypto.symbol}</p>
                    <p className="text-xs text-gray-500">{crypto.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">${crypto.lastPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-green-600 text-xs font-medium">+{crypto.changePercent24h?.toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
        <div className="space-y-6">
          <div className="bg-gray-100 border border-gray-200 rounded-xl p-6 text-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {activeSubscription ? `${activeSubscription.mode} Plan` : "No Active Plan"}
              </h3>
              <i className="fas fa-crown text-xl text-yellow-500"></i>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Usage</span>
                <span className="font-semibold text-gray-900">{(activePredictions as any[])?.length || 0}/200</span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-2">
                <div className="bg-gray-600 h-2 rounded-full" style={{ width: `${Math.min((((activePredictions as any[])?.length || 0) / 200) * 100, 100)}%` }} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Renewal</span>
                <span className="font-semibold text-gray-900">
                  {activeSubscription
                    ? new Date(activeSubscription.endTs * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : "—"}
                </span>
              </div>
            </div>
            <button onClick={() => setLocation('/plans')} className="w-full bg-white text-primary font-semibold py-2 px-4 rounded-lg mt-4 hover:bg-gray-100 transition-colors duration-200">
              {activeSubscription ? "Manage Plan" : "Choose Plan"}
            </button>
          </div>
          <TrainingStatus />
        </div>
      </div>

      {(!subscriptions || (subscriptions as any[]).length === 0) && (
        <div className="bg-gradient-to-r from-blue-100 to-blue-200 border border-blue-300 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div className="text-left">
              <h4 className="font-semibold text-blue-900 text-sm">Subscribe to Start Predicting</h4>
              <p className="text-blue-700 text-xs">Get AI-powered stock predictions with real-time data</p>
            </div>
            <button onClick={() => setLocation('/plans')} className="bg-blue-600 text-white font-medium py-2 px-4 rounded-lg text-sm hover:bg-blue-700 ml-auto">
              Choose Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
