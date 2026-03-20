import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, CreditCard, Activity } from "lucide-react";

export default function Subscription() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", description: "You are logged out.", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: subscriptions, isLoading: subLoading } = useQuery<any[]>({
    queryKey: ["/api/user/subscriptions"],
    enabled: isAuthenticated,
  });

  const { data: activePredictions } = useQuery<any[]>({
    queryKey: ["/api/user/predictions/active"],
    enabled: isAuthenticated,
  });

  const { data: allPredictions } = useQuery<any[]>({
    queryKey: ["/api/user/predictions"],
    enabled: isAuthenticated,
  });

  const { data: allFeedback } = useQuery<any[]>({
    queryKey: ["/api/user/feedback"],
    enabled: isAuthenticated,
  });

  if (isLoading || subLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const activeSubscription = subscriptions?.find(s => new Date(s.endTs * 1000) > new Date()) || null;
  const usagePercentage = activeSubscription ? Math.min(((activePredictions?.length || 0) / 200) * 100, 100) : 0;

  // Real accuracy from feedback
  const totalPredictions = allPredictions?.length || 0;
  let accuracyRate = "—";
  let avgConfidence = "—";

  if ((allFeedback?.length || 0) > 0) {
    const useful = allFeedback!.filter(f => f.useful === 1).length;
    accuracyRate = `${((useful / allFeedback!.length) * 100).toFixed(1)}%`;
  } else if (totalPredictions > 0) {
    accuracyRate = "Pending feedback";
  }

  if (totalPredictions > 0) {
    const avg = allPredictions!.reduce((sum, p) => sum + (p.confidence || 0), 0) / totalPredictions;
    avgConfidence = `${avg.toFixed(1)}%`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-gray-600">Manage your subscription plan and billing information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeSubscription ? (
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-light rounded-lg flex items-center justify-center">
                      <Crown className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Active Plan</CardTitle>
                      <p className="text-gray-600">{activeSubscription.mode} mode · {activeSubscription.tradeType} risk</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div><p className="text-2xl font-bold">₹{activeSubscription.price}</p><p className="text-sm text-gray-600">per {activeSubscription.duration}</p></div>
                  <div><p className="text-2xl font-bold text-primary">{activeSubscription.tradesPerDay}</p><p className="text-sm text-gray-600">trades/day</p></div>
                  <div><p className="text-2xl font-bold">{activePredictions?.length || 0}/200</p><p className="text-sm text-gray-600">predictions</p></div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {Math.max(0, Math.ceil((activeSubscription.endTs * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))}
                    </p>
                    <p className="text-sm text-gray-600">days left</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-gray-600">Usage</span><span className="text-sm font-medium">{Math.round(usagePercentage)}%</span></div>
                  <Progress value={usagePercentage} className="h-2" />
                </div>
                <Button className="w-full" onClick={() => setLocation('/plans')}>
                  <CreditCard className="h-4 w-4 mr-2" />Upgrade Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Crown className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold">No Active Subscription</h3>
                <p className="text-gray-600">Choose a plan to start making predictions.</p>
                <Button onClick={() => setLocation('/plans')}>Choose a Plan</Button>
              </div>
            </Card>
          )}

          {/* Billing History */}
          <Card>
            <CardHeader><CardTitle>Billing History</CardTitle></CardHeader>
            <CardContent>
              {subscriptions && subscriptions.length > 0 ? (
                <div className="space-y-4">
                  {subscriptions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{s.mode} · {s.tradeType} risk</p>
                        <p className="text-sm text-gray-600">
                          {new Date(s.startTs * 1000).toLocaleDateString()} — {new Date(s.endTs * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">₹{s.price}</p>
                        <Badge variant="outline">{new Date(s.endTs * 1000) > new Date() ? "Active" : "Expired"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">No billing history available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Activity className="h-5 w-5 mr-2" />Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Predictions</span>
                <span className="font-semibold">{totalPredictions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Predictions</span>
                <span className="font-semibold text-blue-600">{activePredictions?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Accuracy Rate</span>
                <span className="font-semibold text-green-600">{accuracyRate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Confidence</span>
                <span className="font-semibold text-blue-600">{avgConfidence}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Plan Features</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {["200 predictions/month", "Real-time market data", "Price alerts & notifications", "Advanced charting tools", "Priority customer support"].map(f => (
                <div key={f} className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm">{f}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <h3 className="font-semibold mb-2">Need Help?</h3>
            <p className="text-sm text-gray-600 mb-4">Contact our support team for billing questions.</p>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Support", description: "Email support@bullwiser.com" })}>
              Contact Support
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
