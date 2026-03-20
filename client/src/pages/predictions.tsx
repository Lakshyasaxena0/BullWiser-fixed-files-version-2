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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setTimeout(() => { window.location.href = "/auth"; }, 500);
    }
  }, [isAuthenticated, isLoading]);

  const { data: predictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ["/api/user/predictions"],
    enabled: isAuthenticated,
  });

  const { data: activePredictions } = useQuery({
    queryKey: ["/api/user/predictions/active"],
    enabled: isAuthenticated,
  });

  const { data: feedback } = useQuery({
    queryKey: ["/api/user/feedback"],
    enabled: isAuthenticated,
  });

  // Calculate REAL success rate from feedback
  const realSuccessRate = (() => {
    if (!feedback || feedback.length === 0) return null;
    const useful = feedback.filter((f: any) => f.useful === 1).length;
    return Math.round((useful / feedback.length) * 100);
  })();

  const addToWatchlistMutation = useMutation({
    mutationFn: (stock: string) => {
      setAddingToWatchlist(stock);
      return apiRequest('POST', '/api/user/watchlist', { stock });
    },
    onSuccess: (_, stock) => {
      toast({ title: "Added to watchlist!" });
      setAddedToWatchlist(prev => new Set([...prev, stock]));
      setAddingToWatchlist(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user/watchlist"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add to watchlist", variant: "destructive" });
      setAddingToWatchlist(null);
    },
  });

  if (isLoading || predictionsLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const getConfidenceColor = (c: number) => c >= 80 ? "bg-green-100 text-green-800" : c >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
  const getRiskColor = (r: string) => r === 'low' ? "bg-green-100 text-green-800" : r === 'medium' ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";

  const pastPredictions = predictions?.filter((p: any) => !activePredictions?.some((ap: any) => ap.id === p.id)) || [];

  const PredictionCard = ({ prediction, isPast = false }: { prediction: any; isPast?: boolean }) => {
    const midPrice = (prediction.predLow + prediction.predHigh) / 2;
    const isUptrend = midPrice > prediction.currentPrice;
    return (
      <Card className={`hover:shadow-lg transition-shadow ${isPast ? 'opacity-80' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">{prediction.stock}</CardTitle>
            <div className="flex items-center space-x-2">
              {isUptrend ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
              <Badge className={getConfidenceColor(prediction.confidence)}>{prediction.confidence}% conf.</Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-wrap gap-1">
            <Badge className={getRiskColor(prediction.riskLevel)}>{prediction.riskLevel} risk</Badge>
            <Badge variant="outline">{prediction.mode}</Badge>
            {isPast && <Badge variant="secondary"><Calendar className="h-3 w-3 mr-1" />Completed</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center"><p className="text-gray-500">{isPast ? 'Initial' : 'Current'}</p><p className="font-semibold">₹{prediction.currentPrice?.toFixed(2)}</p></div>
            <div className="text-center"><p className="text-gray-500">Pred. Low</p><p className="font-semibold text-red-600">₹{prediction.predLow?.toFixed(2)}</p></div>
            <div className="text-center"><p className="text-gray-500">Pred. High</p><p className="font-semibold text-green-600">₹{prediction.predHigh?.toFixed(2)}</p></div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center"><Clock className="h-4 w-4 mr-1" />{new Date(prediction.createdAt).toLocaleDateString('en-IN')}</div>
            {prediction.targetDate && <div className="flex items-center"><Target className="h-4 w-4 mr-1" />{new Date(prediction.targetDate).toLocaleDateString('en-IN')}</div>}
          </div>
          {!isPast && (
            <div className="flex space-x-2">
              <Button size="sm" variant={addedToWatchlist.has(prediction.stock) ? "default" : "outline"} className="flex-1"
                onClick={() => addToWatchlistMutation.mutate(prediction.stock)}
                disabled={addingToWatchlist === prediction.stock || addedToWatchlist.has(prediction.stock)}>
                {addingToWatchlist === prediction.stock ? "Adding..." : addedToWatchlist.has(prediction.stock) ? "Added ✓" : "Add to Watchlist"}
              </Button>
              <Button size="sm" className="flex-1">Set Alert</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" />Back to Dashboard
          </Button>
          <div className="border-l pl-4">
            <h1 className="text-2xl font-bold text-gray-900">Prediction History</h1>
            <p className="text-gray-600">View and track all your stock predictions</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="text-center"><p className="text-2xl font-bold text-primary">{activePredictions?.length || 0}</p><p className="text-sm text-gray-700 font-medium">Active</p></div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center"><p className="text-2xl font-bold text-gray-900">{predictions?.length || 0}</p><p className="text-sm text-gray-600 font-medium">Total</p></div>
          </Card>
          {/* Real success rate — only shown when feedback exists */}
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">
                {realSuccessRate !== null ? `${realSuccessRate}%` : '—'}
              </p>
              <p className="text-sm text-gray-700 font-medium">
                {realSuccessRate !== null ? 'Success Rate' : 'No feedback yet'}
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active">Active Predictions ({activePredictions?.length || 0})</TabsTrigger>
          <TabsTrigger value="past">Past Predictions ({pastPredictions?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activePredictions && activePredictions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activePredictions.map((p: any) => <PredictionCard key={p.id} prediction={p} />)}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto"><Clock className="h-8 w-8 text-primary" /></div>
                <h3 className="text-lg font-semibold text-gray-900">No Active Predictions</h3>
                <p className="text-gray-600">Create new predictions from the dashboard to track stocks in real-time.</p>
                <Button onClick={() => setLocation('/')}>Go to Dashboard</Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {pastPredictions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastPredictions.map((p: any) => <PredictionCard key={p.id} prediction={p} isPast />)}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto"><Calendar className="h-8 w-8 text-gray-400" /></div>
                <h3 className="text-lg font-semibold text-gray-900">No Past Predictions</h3>
                <p className="text-gray-600">Your completed predictions will appear here once they reach their target date.</p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <FeedbackForm />
    </div>
  );
}
