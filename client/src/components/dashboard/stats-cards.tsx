import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, Target, Gauge } from "lucide-react";
import { useLocation } from "wouter";

interface StatsCardsProps {
  activePredictions: number;
  subscriptions: any[];
}

export default function StatsCards({ activePredictions, subscriptions }: StatsCardsProps) {
  const [, setLocation] = useLocation();
  const portfolioValue = 245890;
  const dailyChange = 12.5;
  const accuracyRate = 87.3;
  const usagePercentage = Math.round((activePredictions / 200) * 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="text-portfolio-value">
                ₹{portfolioValue.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 font-medium" data-testid="text-daily-change">
                +{dailyChange}% today
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Wallet className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

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
                Click to view history
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Accuracy Rate</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="text-accuracy-rate">
                {accuracyRate}%
              </p>
              <p className="text-sm text-green-600 font-medium" data-testid="text-accuracy-change">
                +2.1% this month
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

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
