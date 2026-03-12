import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, CreditCard, Calendar, Activity } from "lucide-react";

export default function Subscription() {
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

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery<any[]>({
    queryKey: ["/api/user/subscriptions"],
    enabled: isAuthenticated,
  });

  const { data: activePredictions } = useQuery<any[]>({
    queryKey: ["/api/user/predictions/active"],
    enabled: isAuthenticated,
  });

  if (isLoading || subscriptionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeSubscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;
  const usagePercentage = activeSubscription ? Math.min(((activePredictions?.length || 0) / 200) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">Subscription</h1>
          <p className="text-gray-600" data-testid="text-page-description">
            Manage your subscription plan and billing information
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Plan */}
        <div className="lg:col-span-2 space-y-6">
          {activeSubscription ? (
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-light opacity-5" />
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-light rounded-lg flex items-center justify-center">
                      <Crown className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl" data-testid="text-plan-name">Premium Plan</CardTitle>
                      <p className="text-gray-600" data-testid="text-plan-mode">
                        {activeSubscription.mode} mode • {activeSubscription.tradeType} risk
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-plan-status">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-plan-price">
                      ₹{activeSubscription.price}
                    </p>
                    <p className="text-sm text-gray-600">
                      per {activeSubscription.duration}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary" data-testid="text-trades-per-day">
                      {activeSubscription.tradesPerDay}
                    </p>
                    <p className="text-sm text-gray-600">trades/day</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-usage-count">
                      {activePredictions?.length || 0}/200
                    </p>
                    <p className="text-sm text-gray-600">predictions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600" data-testid="text-renewal-days">
                      {Math.max(0, Math.ceil((activeSubscription.endTs * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))}
                    </p>
                    <p className="text-sm text-gray-600">days left</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Usage</span>
                    <span className="text-sm font-medium" data-testid="text-usage-percentage">
                      {Math.round(usagePercentage)}%
                    </span>
                  </div>
                  <Progress value={usagePercentage} className="h-2" data-testid="progress-usage" />
                </div>

                <div className="flex">
                  <Button 
                    className="flex-1" 
                    data-testid="button-upgrade-plan"
                    onClick={() => setLocation('/plans')}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Upgrade Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Crown className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900" data-testid="text-no-subscription-title">
                  No Active Subscription
                </h3>
                <p className="text-gray-600" data-testid="text-no-subscription-description">
                  Choose a plan to start making predictions and accessing premium features.
                </p>
                <Button 
                  data-testid="button-choose-plan"
                  onClick={() => setLocation('/plans')}
                >
                  Choose a Plan
                </Button>
              </div>
            </Card>
          )}

          {/* Billing History */}
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-billing-history-title">Billing History</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptions && subscriptions.length > 0 ? (
                <div className="space-y-4">
                  {subscriptions.map((subscription: any) => (
                    <div key={subscription.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium" data-testid={`text-billing-plan-${subscription.id}`}>
                          {subscription.mode} • {subscription.tradeType} risk
                        </p>
                        <p className="text-sm text-gray-600" data-testid={`text-billing-date-${subscription.id}`}>
                          {new Date(subscription.startTs * 1000).toLocaleDateString()} - {new Date(subscription.endTs * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold" data-testid={`text-billing-amount-${subscription.id}`}>
                          ₹{subscription.price}
                        </p>
                        <Badge variant="outline" data-testid={`badge-billing-status-${subscription.id}`}>
                          Completed
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8" data-testid="text-no-billing-history">
                  No billing history available
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center" data-testid="text-usage-stats-title">
                <Activity className="h-5 w-5 mr-2" />
                Usage Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Month</span>
                <span className="font-semibold" data-testid="text-monthly-predictions">
                  {activePredictions?.length || 0} predictions
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Accuracy Rate</span>
                <span className="font-semibold text-green-600" data-testid="text-accuracy-rate">87.3%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Confidence</span>
                <span className="font-semibold text-blue-600" data-testid="text-avg-confidence">84.7%</span>
              </div>
            </CardContent>
          </Card>

          {/* Plan Features */}
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-plan-features-title">Plan Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm" data-testid="text-feature-predictions">200 predictions/month</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm" data-testid="text-feature-realtime">Real-time market data</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm" data-testid="text-feature-alerts">Price alerts & notifications</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm" data-testid="text-feature-charts">Advanced charting tools</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm" data-testid="text-feature-support">Priority customer support</span>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <Card className="text-center p-6">
            <h3 className="font-semibold mb-2" data-testid="text-support-title">Need Help?</h3>
            <p className="text-sm text-gray-600 mb-4" data-testid="text-support-description">
              Contact our support team for any billing or subscription questions.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              data-testid="button-contact-support"
              onClick={() => toast({
                title: "Support",
                description: "Email support@bullwiser.com for assistance",
              })}
            >
              Contact Support
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}