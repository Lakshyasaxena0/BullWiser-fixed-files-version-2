import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, TrendingUp, Search, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

export default function ActivityFeed() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: predictions } = useQuery({
    queryKey: ["/api/user/predictions"],
    enabled: isAuthenticated,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["/api/user/subscriptions"],
    enabled: isAuthenticated,
  });

  // Build real activity from actual user data
  const activities: any[] = [];

  // Add predictions as activities
  if (predictions && predictions.length > 0) {
    predictions.slice(0, 3).forEach((p: any) => {
      const isCrypto = p.stock?.startsWith('CRYPTO_');
      const symbol = isCrypto ? p.stock.replace('CRYPTO_', '') : p.stock;
      activities.push({
        id: `pred-${p.id}`,
        icon: TrendingUp,
        iconColor: 'bg-blue-500',
        title: `${isCrypto ? 'Crypto' : 'Stock'} prediction for ${symbol}`,
        description: `Target: ₹${p.predLow?.toFixed(2)} – ₹${p.predHigh?.toFixed(2)} | Confidence: ${p.confidence?.toFixed(1)}%`,
        time: p.createdAt ? formatDistanceToNow(new Date(p.createdAt), { addSuffix: true }) : 'recently',
        sortTime: p.createdAt ? new Date(p.createdAt).getTime() : 0,
      });
    });
  }

  // Add subscriptions as activities
  if (subscriptions && subscriptions.length > 0) {
    subscriptions.slice(0, 2).forEach((s: any) => {
      activities.push({
        id: `sub-${s.id}`,
        icon: CheckCircle,
        iconColor: 'bg-green-500',
        title: `Subscription activated: ${s.mode} plan`,
        description: `${s.tradeType} · ${s.tradesPerDay} trades/day · ₹${s.price}`,
        time: s.createdAt ? formatDistanceToNow(new Date(s.createdAt), { addSuffix: true }) : 'recently',
        sortTime: s.createdAt ? new Date(s.createdAt).getTime() : 0,
      });
    });
  }

  // Sort by most recent
  activities.sort((a, b) => b.sortTime - a.sortTime);

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold" data-testid="text-activity-title">
            Recent Activity
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation('/activities')}>
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-3">
            <Search className="h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-center text-gray-400">
              Your predictions and subscriptions will appear here
            </p>
            <Button size="sm" variant="outline" onClick={() => setLocation('/plans')}>
              Get Started
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 5).map((activity) => {
              const Icon = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className={`w-10 h-10 ${activity.iconColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{activity.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />{activity.time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
