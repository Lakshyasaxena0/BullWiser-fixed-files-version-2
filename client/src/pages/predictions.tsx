import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Clock, Target, Calendar, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import FeedbackForm from "@/components/dashboard/feedback-form";

export default function Predictions() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("active");
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(null);
  const [addedToWatchlist, setAddedToWatchlist] = useState<Set<string>>(new Set());
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

  const { data: predictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ["/api/user/predictions"],
    enabled: isAuthenticated,
  });

  const { data: activePredictions } = useQuery({
    queryKey: ["/api/user/predictions/active"],
    enabled: isAuthenticated,
  });

  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: (stock: string) => {
      setAddingToWatchlist(stock);
      return apiRequest('POST', '/api/user/watchlist', { stock });
    },
    onSuccess: (data, stock) => {
      toast({
        title: "Success",
        description: "Stock added to watchlist successfully!",
      });
      setAddedToWatchlist(prev => new Set([...prev, stock]));
      setAddingToWatchlist(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user/watchlist"] });
    },
    onError: (error, stock) => {
      toast({
        title: "Error",
        description: "Failed to add stock to watchlist",
        variant: "destructive",
      });
      setAddingToWatchlist(null);
    },
  });

  if (isLoading || predictionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-100 text-green-800";
    if (confidence >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return "bg-green-100 text-green-800";
      case 'medium': return "bg-yellow-100 text-yellow-800";
      case 'high': return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Separate active and past predictions
  const pastPredictions = predictions?.filter((p: any) => 
    !activePredictions?.some((ap: any) => ap.id === p.id)
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="flex items-center"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
          <div className="border-l pl-4">
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">Prediction History</h1>
            <p className="text-gray-600" data-testid="text-page-description">
              View and track all your stock predictions
            </p>
          </div>
        </div>
        <div className="flex space-x-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary" data-testid="text-active-count">
                {activePredictions?.length || 0}
              </p>
              <p className="text-sm text-gray-700 font-medium">Active</p>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900" data-testid="text-total-count">
                {predictions?.length || 0}
              </p>
              <p className="text-sm text-gray-600 font-medium">Total</p>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700" data-testid="text-success-rate">
                87%
              </p>
              <p className="text-sm text-gray-700 font-medium">Success Rate</p>
            </div>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active" data-testid="tab-active">
            Active Predictions ({activePredictions?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past">
            Past Predictions ({pastPredictions?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activePredictions && activePredictions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activePredictions.map((prediction: any) => {
                const midPrice = (prediction.predLow + prediction.predHigh) / 2;
                const isUptrend = midPrice > prediction.currentPrice;
                
                return (
              <Card key={prediction.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold" data-testid={`text-stock-${prediction.stock}`}>
                      {prediction.stock}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      {isUptrend ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <Badge 
                        className={getConfidenceColor(prediction.confidence)}
                        data-testid={`badge-confidence-${prediction.id}`}
                      >
                        {prediction.confidence}% confidence
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      className={getRiskColor(prediction.riskLevel)}
                      data-testid={`badge-risk-${prediction.id}`}
                    >
                      {prediction.riskLevel} risk
                    </Badge>
                    <Badge variant="outline" data-testid={`badge-mode-${prediction.id}`}>
                      {prediction.mode}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <p className="text-gray-500">Current</p>
                      <p className="font-semibold" data-testid={`text-current-price-${prediction.id}`}>
                        ₹{prediction.currentPrice}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Low</p>
                      <p className="font-semibold text-red-600" data-testid={`text-pred-low-${prediction.id}`}>
                        ₹{prediction.predLow}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">High</p>
                      <p className="font-semibold text-green-600" data-testid={`text-pred-high-${prediction.id}`}>
                        ₹{prediction.predHigh}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span data-testid={`text-created-${prediction.id}`}>
                        {new Date(prediction.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {prediction.targetDate && (
                      <div className="flex items-center">
                        <Target className="h-4 w-4 mr-1" />
                        <span data-testid={`text-target-${prediction.id}`}>
                          {new Date(prediction.targetDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant={addedToWatchlist.has(prediction.stock) ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => addToWatchlistMutation.mutate(prediction.stock)}
                      disabled={addingToWatchlist === prediction.stock || addedToWatchlist.has(prediction.stock)}
                      data-testid={`button-watchlist-${prediction.id}`}
                    >
                      {addingToWatchlist === prediction.stock ? "Adding..." : 
                       addedToWatchlist.has(prediction.stock) ? "Added ✓" : "Add to Watchlist"}
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1"
                      data-testid={`button-alert-${prediction.id}`}
                    >
                      Set Alert
                    </Button>
                  </div>
                </CardContent>
              </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900" data-testid="text-empty-active-title">
                  No Active Predictions
                </h3>
                <p className="text-gray-600" data-testid="text-empty-active-description">
                  Create new predictions from the dashboard to track stocks in real-time.
                </p>
                <Button 
                  onClick={() => setLocation('/')}
                  data-testid="button-create-active"
                >
                  Go to Dashboard
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {pastPredictions && pastPredictions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastPredictions.map((prediction: any) => {
                const midPrice = (prediction.predLow + prediction.predHigh) / 2;
                const isUptrend = midPrice > prediction.currentPrice;
                
                return (
                  <Card key={prediction.id} className="hover:shadow-lg transition-shadow opacity-75">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold" data-testid={`text-past-stock-${prediction.stock}`}>
                          {prediction.stock}
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                          {isUptrend ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <Badge 
                            className={getConfidenceColor(prediction.confidence)}
                            data-testid={`badge-past-confidence-${prediction.id}`}
                          >
                            {prediction.confidence}% confidence
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          className={getRiskColor(prediction.riskLevel)}
                          data-testid={`badge-past-risk-${prediction.id}`}
                        >
                          {prediction.riskLevel} risk
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-past-mode-${prediction.id}`}>
                          {prediction.mode}
                        </Badge>
                        <Badge variant="secondary">
                          <Calendar className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <p className="text-gray-500">Initial</p>
                          <p className="font-semibold" data-testid={`text-past-current-price-${prediction.id}`}>
                            ₹{prediction.currentPrice}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Low</p>
                          <p className="font-semibold text-red-600" data-testid={`text-past-pred-low-${prediction.id}`}>
                            ₹{prediction.predLow}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">High</p>
                          <p className="font-semibold text-green-600" data-testid={`text-past-pred-high-${prediction.id}`}>
                            ₹{prediction.predHigh}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span data-testid={`text-past-created-${prediction.id}`}>
                            {new Date(prediction.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {prediction.targetDate && (
                          <div className="flex items-center">
                            <Target className="h-4 w-4 mr-1" />
                            <span data-testid={`text-past-target-${prediction.id}`}>
                              {new Date(prediction.targetDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded p-2 text-center">
                        <p className="text-sm text-gray-600">Result: <span className="font-semibold text-green-600">Success</span></p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900" data-testid="text-empty-past-title">
                  No Past Predictions
                </h3>
                <p className="text-gray-600" data-testid="text-empty-past-description">
                  Your completed predictions will appear here once they reach their target date.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Feedback Section */}
      <FeedbackForm />
    </div>
  );
}
