import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Check, TrendingUp, Shield, Zap, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Plans() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPlan, setSelectedPlan] = useState({
    mode: "suggestion",
    tradeType: "medium",
    tradesPerDay: 5,
    duration: "monthly",
  });

  // Current subscriptions
  const { data: subscriptions } = useQuery<any[]>({
    queryKey: ["/api/user/subscriptions"],
    enabled: isAuthenticated,
  });

  // ── FIX: parse response as JSON so estimate fields are available ──────────
  const { data: estimate, isLoading: estimateLoading } = useQuery<any>({
    queryKey: ["/api/billing/estimate", selectedPlan],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/billing/estimate", selectedPlan);
      return res.json();
    },
  });

  // Subscribe mutation — also parse JSON response
  const subscribeMutation = useMutation({
    mutationFn: async (planData: any) => {
      const res = await apiRequest("POST", "/api/subscribe", planData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Activated! 🎉",
        description: "Your plan is now active. You can start making predictions!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscriptions"] });
    },
    onError: () => {
      toast({
        title: "Subscription Failed",
        description: "There was an error creating your subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const activeSubscription = subscriptions?.find(
    (s: any) => new Date(s.endTs * 1000) > new Date()
  ) || null;
  const hasActiveSubscription = !!activeSubscription;

  const planFeatures = {
    suggestion: [
      "AI-powered stock suggestions",
      "Technical analysis insights",
      "Risk assessment",
      "Basic market alerts",
    ],
    auto: [
      "All suggestion features",
      "Automated trading signals",
      "Advanced risk management",
      "Priority market alerts",
      "Portfolio optimization",
    ],
  };

  const riskLevels: Record<string, { name: string; color: string }> = {
    low:    { name: "Conservative", color: "text-green-600" },
    medium: { name: "Balanced",     color: "text-blue-600"  },
    high:   { name: "Aggressive",   color: "text-red-600"   },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
        <p className="text-gray-600">Choose the perfect plan for your trading needs</p>
      </div>

      {/* Active plan banner */}
      {hasActiveSubscription && (
        <Card className="border-primary bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Crown className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-primary">Current Active Plan</CardTitle>
                  <p className="text-gray-600 text-sm">
                    {activeSubscription.mode} mode · {activeSubscription.tradeType} risk · {activeSubscription.tradesPerDay} trades/day
                  </p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-sm text-gray-600">Price</p><p className="text-lg font-semibold">₹{activeSubscription.price}</p></div>
              <div><p className="text-sm text-gray-600">Duration</p><p className="text-lg font-semibold capitalize">{activeSubscription.duration}</p></div>
              <div><p className="text-sm text-gray-600">Expires</p><p className="text-lg font-semibold">{new Date(activeSubscription.endTs * 1000).toLocaleDateString("en-IN")}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration */}
        <Card>
          <CardHeader><CardTitle>Configure Your Plan</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            <div>
              <label className="text-sm font-medium mb-2 block">Trading Mode</label>
              <Select value={selectedPlan.mode} onValueChange={v => setSelectedPlan(p => ({ ...p, mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggestion">Suggestion Mode</SelectItem>
                  <SelectItem value="auto">Auto Mode</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {selectedPlan.mode === "auto" ? "Automated signals for direct trading" : "AI recommendations for manual trading"}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Risk Level</label>
              <Select value={selectedPlan.tradeType} onValueChange={v => setSelectedPlan(p => ({ ...p, tradeType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low"><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-green-600" /><span>Conservative</span></div></SelectItem>
                  <SelectItem value="medium"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-600" /><span>Balanced</span></div></SelectItem>
                  <SelectItem value="high"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-red-600" /><span>Aggressive</span></div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Trades Per Day</label>
              <Select value={selectedPlan.tradesPerDay.toString()} onValueChange={v => setSelectedPlan(p => ({ ...p, tradesPerDay: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 trades/day</SelectItem>
                  <SelectItem value="5">5 trades/day</SelectItem>
                  <SelectItem value="10">10 trades/day</SelectItem>
                  <SelectItem value="20">20 trades/day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Billing Period</label>
              <Select value={selectedPlan.duration} onValueChange={v => setSelectedPlan(p => ({ ...p, duration: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (5% off)</SelectItem>
                  <SelectItem value="monthly">Monthly (10% off)</SelectItem>
                  <SelectItem value="yearly">Yearly (20% off)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <h4 className="font-medium mb-3">Plan Features</h4>
              <div className="space-y-2">
                {planFeatures[selectedPlan.mode as keyof typeof planFeatures].map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Subscribe */}
        <Card>
          <CardHeader><CardTitle>Plan Summary</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {estimateLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : estimate ? (
              <>
                {/* Price breakdown */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Base Price</span>
                    <span className="font-medium">₹{estimate.basePrice?.toLocaleString("en-IN")}</span>
                  </div>

                  {estimate.durationDiscountApplied > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Duration Discount ({estimate.durationDiscountApplied}%)</span>
                      <span>-₹{(estimate.basePrice - estimate.afterDurationDiscount)?.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {estimate.autoModeSurcharge > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Auto Mode Surcharge</span>
                      <span>+₹{estimate.autoModeSurcharge?.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <hr />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">₹{estimate.finalBill?.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Plan details */}
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p><strong className="text-gray-900">Mode:</strong> {selectedPlan.mode === "auto" ? "Auto Trading" : "Suggestion"}</p>
                  <p><strong className="text-gray-900">Risk Level:</strong> {riskLevels[selectedPlan.tradeType]?.name}</p>
                  <p><strong className="text-gray-900">Trades:</strong> {selectedPlan.tradesPerDay} per day</p>
                  <p><strong className="text-gray-900">Duration:</strong> <span className="capitalize">{selectedPlan.duration}</span></p>
                </div>

                {/* ── Subscribe button ── */}
                {hasActiveSubscription ? (
                  <div className="space-y-3">
                    <Button className="w-full" size="lg" disabled>
                      <Check className="h-4 w-4 mr-2" />
                      Plan Already Active
                    </Button>
                    <p className="text-xs text-center text-gray-500">
                      Your current plan is active until{" "}
                      <strong>{new Date(activeSubscription.endTs * 1000).toLocaleDateString("en-IN")}</strong>.
                      New plans can be subscribed after expiry.
                    </p>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                    size="lg"
                    onClick={() => subscribeMutation.mutate(selectedPlan)}
                    disabled={subscribeMutation.isPending}
                  >
                    {subscribeMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                    ) : (
                      <>
                        <Crown className="h-4 w-4 mr-2" />
                        Subscribe for ₹{estimate.finalBill?.toLocaleString("en-IN")}
                      </>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-center text-gray-500 py-8">Unable to load pricing. Please refresh.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />Suggestion Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {planFeatures.suggestion.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" /><span className="text-sm">{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />Auto Mode
              <Badge className="bg-primary text-white ml-1">Premium</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {planFeatures.auto.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" /><span className="text-sm">{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
