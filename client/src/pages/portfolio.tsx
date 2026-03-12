import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Eye, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function Portfolio() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: watchlist, isLoading: watchlistLoading } = useQuery<any[]>({
    queryKey: ["/api/user/watchlist"],
    enabled: isAuthenticated,
  });

  const { data: activePredictions } = useQuery<any[]>({
    queryKey: ["/api/user/predictions/active"],
    enabled: isAuthenticated,
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (stock: string) => {
      await apiRequest("DELETE", `/api/user/watchlist/${stock}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/watchlist"] });
      toast({
        title: "Success",
        description: "Stock removed from watchlist",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove stock from watchlist",
        variant: "destructive",
      });
    },
  });

  if (isLoading || watchlistLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">Portfolio</h1>
          <p className="text-gray-600" data-testid="text-page-description">
            Manage your watchlist and track your investment portfolio
          </p>
        </div>
      </div>

      <Tabs defaultValue="watchlist" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="watchlist" data-testid="tab-watchlist">Watchlist</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">Active Predictions</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="watchlist" className="space-y-4">
          {watchlist && watchlist.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchlist.map((item: any) => (
                <Card key={item.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold" data-testid={`text-watchlist-stock-${item.stock}`}>
                        {item.stock}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFromWatchlistMutation.mutate(item.stock)}
                        disabled={removeFromWatchlistMutation.isPending}
                        data-testid={`button-remove-${item.stock}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500" data-testid={`text-added-date-${item.id}`}>
                      Added {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" className="flex-1" data-testid={`button-view-${item.stock}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      <Button size="sm" className="flex-1" data-testid={`button-predict-${item.stock}`}>
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Predict
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Eye className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900" data-testid="text-empty-watchlist-title">
                  Your Watchlist is Empty
                </h3>
                <p className="text-gray-600" data-testid="text-empty-watchlist-description">
                  Add stocks to your watchlist to keep track of their performance and predictions.
                </p>
                <Button onClick={() => window.location.href = '/'} data-testid="button-add-stocks">
                  Add Stocks to Watchlist
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activePredictions && activePredictions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePredictions.map((prediction: any) => (
                <Card key={prediction.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold" data-testid={`text-active-stock-${prediction.stock}`}>
                        {prediction.stock}
                      </CardTitle>
                      <Badge className="bg-green-100 text-green-800" data-testid={`badge-active-${prediction.id}`}>
                        Active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center">
                        <p className="text-gray-500">Current</p>
                        <p className="font-semibold" data-testid={`text-active-current-${prediction.id}`}>
                          ₹{prediction.currentPrice}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">Target Low</p>
                        <p className="font-semibold text-red-600" data-testid={`text-active-low-${prediction.id}`}>
                          ₹{prediction.predLow}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">Target High</p>
                        <p className="font-semibold text-green-600" data-testid={`text-active-high-${prediction.id}`}>
                          ₹{prediction.predHigh}
                        </p>
                      </div>
                    </div>
                    <div className="text-center">
                      <Badge className="bg-blue-100 text-blue-800" data-testid={`badge-confidence-${prediction.id}`}>
                        {prediction.confidence}% confidence
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <TrendingUp className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900" data-testid="text-empty-active-title">
                  No Active Predictions
                </h3>
                <p className="text-gray-600" data-testid="text-empty-active-description">
                  Create new predictions to start tracking their performance.
                </p>
                <Button onClick={() => window.location.href = '/'} data-testid="button-create-prediction">
                  Create Prediction
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2" data-testid="text-total-return">+12.5%</div>
              <p className="text-gray-600">Total Return</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2" data-testid="text-accuracy-rate">87.3%</div>
              <p className="text-gray-600">Accuracy Rate</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2" data-testid="text-total-predictions">
                {(activePredictions?.length || 0) + ((watchlist?.length || 0) * 2)}
              </div>
              <p className="text-gray-600">Total Predictions</p>
            </Card>
          </div>

          <Card className="p-6">
            <CardTitle className="mb-4" data-testid="text-performance-title">Portfolio Performance</CardTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4 text-center">
                <div className="text-lg font-bold text-blue-600">+2.1%</div>
                <p className="text-xs text-gray-600">1 Day</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-lg font-bold text-green-600">+8.5%</div>
                <p className="text-xs text-gray-600">7 Days</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-lg font-bold text-green-600">+12.3%</div>
                <p className="text-xs text-gray-600">14 Days</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-lg font-bold text-green-600">+15.7%</div>
                <p className="text-xs text-gray-600">21 Days</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-lg font-bold text-green-600">+18.2%</div>
                <p className="text-xs text-gray-600">28 Days</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-lg font-bold text-green-600">+22.1%</div>
                <p className="text-xs text-gray-600">2 Months</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-lg font-bold text-green-600">+28.5%</div>
                <p className="text-xs text-gray-600">4 Months</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-lg font-bold text-green-600">+32.8%</div>
                <p className="text-xs text-gray-600">6 Months</p>
              </Card>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Best Performing Stock</span>
                <span className="font-semibold text-green-600" data-testid="text-best-stock">RELIANCE (+15.2%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Worst Performing Stock</span>
                <span className="font-semibold text-red-600" data-testid="text-worst-stock">HDFC (-2.1%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Win Rate</span>
                <span className="font-semibold" data-testid="text-win-rate">78%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Hold Time</span>
                <span className="font-semibold" data-testid="text-avg-hold-time">5.2 days</span>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
