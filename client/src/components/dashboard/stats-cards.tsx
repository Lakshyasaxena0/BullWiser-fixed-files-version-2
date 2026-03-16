import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, Target, Gauge } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardsProps {
  activePredictions: number;
  subscriptions: any[];
}

export default function StatsCards({ activePredictions, subscriptions }: StatsCardsProps) {
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery<{
    portfolioValue: number;
    portfolioPerformance: number;
    accuracyRate: number;
    totalPredictions: number;
    activePredictionsCount: number;
    totalFeedback: number;
  }>({
    queryKey: ["/api/user/dashboard-stats"],
    staleTime: 60000,
  });

  const { data: marketData } = useQuery<any>({
    queryKey: ["/api/market/overview"],
    staleTime: 60000,
  });

  const niftyChange = marketData?.indices?.nifty50?.changePercent ?? null;

  const usagePercentage = Math.round((activePredictions / 200) * 100);

  const formatCurrency = (val: number) => {
    if (!val) return '₹0';
    return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (val: number) => {
    if (val === null || val === undefined) return null;
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const portfolioValue = stats?.portfolioValue ?? 0;
  const portfolioPerformance = stats?.portfolioPerformance ?? 0;
  const accuracyRate = stats?.accuracyRate ?? 0;
  const totalPredictions = stats?.totalPredictions ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Portfolio Value */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="text-portfolio-value">
                {portfolioValue > 0 ? formatCurrency(portfolioValue) : '₹0'}
              </p>
              {niftyChange !== null ? (
                <p className={`text-sm font-medium ${niftyChange >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-daily-change">
                  Nifty {formatPercent(niftyChange)} today
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  {totalPredictions === 0 ? 'No predictions yet' : 'Market data loading...'}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Wallet className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Predictions */}
      <Card
        className="hover:shadow-lg transition-shadow cursor-pointer hover:border-primary"
        onClick={() => setLocation('/predictions')}
        data-testid="card-active-predictions"
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Predictions</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="text-active-predictions">
                {activePredictions}
              </p>
              <p className="text-sm text-primary font-medium" data-testid="text-pending-alerts">
                {totalPredictions > 0 ? `${totalPredictions} total made` : 'Click to view history'}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accuracy Rate */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Accuracy Rate</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="text-accuracy-rate">
                {accuracyRate > 0 ? `${accuracyRate}%` : '—'}
              </p>
              <p className={`text-sm font-medium ${portfolioPerformance >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-accuracy-change">
                {accuracyRate > 0
                  ? (portfolioPerformance !== 0 ? `Pred. upside: ${formatPercent(portfolioPerformance)}` : 'Based on your predictions')
                  : 'Make predictions to track'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Usage */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Subscription Usage</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="text-usage-percentage">
                {usagePercentage}%
              </p>
              <p className="text-sm text-orange-600 font-medium" data-testid="text-usage-details">
                {activePredictions} of 200 predictions
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Gauge className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
