import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Check, TrendingUp, Shield, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Plans() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPlan, setSelectedPlan] = useState({
    mode: 'suggestion',
    tradeType: 'medium',
    tradesPerDay: 5,
    duration: 'monthly'
  });

  // Get current subscriptions
  const { data: subscriptions } = useQuery<any[]>({
    queryKey: ["/api/user/subscriptions"],
    enabled: isAuthenticated,
  });

  // Get billing estimate
  const { data: estimate } = useQuery({
    queryKey: ["/api/billing/estimate", selectedPlan],
    queryFn: () => apiRequest('POST', '/api/billing/estimate', selectedPlan),
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: (planData: any) => apiRequest('POST', '/api/subscribe', planData),
    onSuccess: () => {
      toast({
        title: "Subscription Created",
        description: "Your new plan has been activated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscriptions"] });
    },
    onError: () => {
      toast({
        title: "Subscription Failed",
        description: "There was an error creating your subscription.",
        variant: "destructive",
      });
    },
  });

  const activeSubscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;
  const hasActiveSubscription = activeSubscription && new Date(activeSubscription.endTs * 1000) > new Date();

  const planFeatures = {
    suggestion: [
      "AI-powered stock suggestions",
      "Technical analysis insights",
      "Risk assessment",
      "Basic market alerts"
    ],
    auto: [
      "All suggestion features",
      "Automated trading signals",
      "Advanced risk management",
      "Priority market alerts",
      "Portfolio optimization"
    ]
  };

  const riskLevels = {
    low: { name: "Conservative", color: "text-green-600", icon: Shield },
    medium: { name: "Balanced", color: "text-blue-600", icon: TrendingUp },
    high: { name: "Aggressive", color: "text-red-600", icon: Zap }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="text-gray-600">Choose the perfect plan for your trading needs</p>
        </div>
      </div>

      {/* Current Plan Status */}
      {hasActiveSubscription && (
        <Card className="border-primary bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Crown className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-primary">Current Active Plan</CardTitle>
                  <p className="text-gray-600">
                    {activeSubscription.mode} mode • {activeSubscription.tradeType} risk • {activeSubscription.tradesPerDay} trades/day
                  </p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Price</p>
                <p className="text-lg font-semibold">₹{activeSubscription.price}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="text-lg font-semibold">{activeSubscription.duration}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Expires</p>
                <p className="text-lg font-semibold">
                  {new Date(activeSubscription.endTs * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Plan Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configure Your Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Trading Mode</label>
              <Select value={selectedPlan.mode} onValueChange={(value) => setSelectedPlan({...selectedPlan, mode: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggestion">Suggestion Mode</SelectItem>
                  <SelectItem value="auto">Auto Mode</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {selectedPlan.mode === 'auto' ? 'Automated signals for direct trading' : 'AI recommendations for manual trading'}
              </p>
            </div>

            {/* Risk Level */}
            <div>
              <label className="text-sm font-medium mb-2 block">Risk Level</label>
              <Select value={selectedPlan.tradeType} onValueChange={(value) => setSelectedPlan({...selectedPlan, tradeType: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span>Conservative</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span>Balanced</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4 text-red-600" />
                      <span>Aggressive</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Trades Per Day */}
            <div>
              <label className="text-sm font-medium mb-2 block">Trades Per Day</label>
              <Select value={selectedPlan.tradesPerDay.toString()} onValueChange={(value) => setSelectedPlan({...selectedPlan, tradesPerDay: parseInt(value)})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 trades/day</SelectItem>
                  <SelectItem value="5">5 trades/day</SelectItem>
                  <SelectItem value="10">10 trades/day</SelectItem>
                  <SelectItem value="20">20 trades/day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div>
              <label className="text-sm font-medium mb-2 block">Billing Period</label>
              <Select value={selectedPlan.duration} onValueChange={(value) => setSelectedPlan({...selectedPlan, duration: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (5% off)</SelectItem>
                  <SelectItem value="monthly">Monthly (10% off)</SelectItem>
                  <SelectItem value="yearly">Yearly (20% off)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Features */}
            <div>
              <h4 className="font-medium mb-3">Plan Features</h4>
              <div className="space-y-2">
                {planFeatures[selectedPlan.mode as keyof typeof planFeatures].map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Checkout */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {estimate && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span>Base Price</span>
                    <span>₹{estimate.basePrice}</span>
                  </div>

                  {estimate.durationDiscountApplied > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Duration Discount ({estimate.durationDiscountApplied}%)</span>
                      <span>-₹{estimate.basePrice - estimate.afterDurationDiscount}</span>
                    </div>
                  )}

                  {estimate.autoModeSurcharge > 0 && (
                    <div className="flex justify-between">
                      <span>Auto Mode Surcharge</span>
                      <span>+₹{estimate.autoModeSurcharge}</span>
                    </div>
                  )}

                  <hr />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>₹{estimate.finalBill}</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Mode:</strong> {selectedPlan.mode}</p>
                  <p><strong>Risk Level:</strong> {riskLevels[selectedPlan.tradeType as keyof typeof riskLevels].name}</p>
                  <p><strong>Trades:</strong> {selectedPlan.tradesPerDay} per day</p>
                  <p><strong>Duration:</strong> {selectedPlan.duration}</p>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => subscribeMutation.mutate(selectedPlan)}
                  disabled={subscribeMutation.isPending || hasActiveSubscription}
                >
                  {subscribeMutation.isPending ? (
                    "Processing..."
                  ) : hasActiveSubscription ? (
                    "Current Plan Active"
                  ) : (
                    `Subscribe for ₹${estimate.finalBill}`
                  )}
                </Button>

                {hasActiveSubscription && (
                  <p className="text-xs text-gray-500 text-center">
                    You have an active subscription. New plans will be available after expiry.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Suggestion Mode</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {planFeatures.suggestion.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-primary" />
              <span>Auto Mode</span>
              <Badge className="bg-primary text-white">Premium</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {planFeatures.auto.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}