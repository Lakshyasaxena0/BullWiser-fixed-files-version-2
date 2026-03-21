import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Clock, Target, Calendar, ChevronLeft, Search, Zap, AlertTriangle, BookmarkPlus, BookmarkCheck } from "lucide-react";
import { useLocation } from "wouter";
import FeedbackForm from "@/components/dashboard/feedback-form";

export default function Predictions() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("make");
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(null);
  const [addedToWatchlist, setAddedToWatchlist] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const [predType, setPredType] = useState<"stock" | "crypto">("stock");
  const [symbol, setSymbol] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [horizon, setHorizon] = useState("1w");
  const [mode, setMode] = useState("suggestion");
  const [riskLevel, setRiskLevel] = useState("medium");
  const [predResult, setPredResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setTimeout(() => { window.location.href = "/auth"; }, 500);
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.length < 2) { setSearchResults([]); setSearchAttempted(false); return; }
      setIsSearching(true);
      setSearchAttempted(false);
      try {
        const endpoint = predType === "crypto"
          ? `/api/search/crypto?q=${encodeURIComponent(searchQuery)}`
          : `/api/search/stocks?q=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(endpoint);
        if (res.ok) setSearchResults(await res.json() || []);
        else setSearchResults([]);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); setSearchAttempted(true); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, predType]);

  const { data: predictions, isLoading: predsLoading } = useQuery({ queryKey: ["/api/user/predictions"], enabled: isAuthenticated });
  const { data: activePredictions } = useQuery({ queryKey: ["/api/user/predictions/active"], enabled: isAuthenticated });

  const getTargetDateFromHorizon = () => {
    if (targetDate) return targetDate;
    const d = new Date();
    if (horizon === "1d") d.setDate(d.getDate() + 1);
    else if (horizon === "1w") d.setDate(d.getDate() + 7);
    else if (horizon === "1m") d.setMonth(d.getMonth() + 1);
    else if (horizon === "3m") d.setMonth(d.getMonth() + 3);
    else if (horizon === "6m") d.setMonth(d.getMonth() + 6);
    else if (horizon === "1y") d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  };

  const predictMutation = useMutation({
    mutationFn: async () => {
      if (!symbol) throw new Error("Please select a stock or crypto symbol");
      const when = getTargetDateFromHorizon();
      if (predType === "stock") {
        const res = await apiRequest("POST", "/api/predict", { stock: symbol, when, mode, riskLevel });
        return await res.json();
      } else {
        const res = await apiRequest("POST", "/api/crypto/predict", { crypto: symbol, when, mode, riskLevel, tradesPerDay: 1, cryptoValue: 10000, duration: "daily" });
        return await res.json();
      }
    },
    onSuccess: (data: any) => {
      setPredResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/user/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/predictions/active"] });
      toast({ title: "Prediction Generated!", description: `${symbol} prediction ready` });
    },
    onError: (err: Error) => {
      toast({ title: "Prediction Failed", description: err.message, variant: "destructive" });
    },
  });

  // ── FIX 2: Single source-of-truth for watchlist key ──────────────────────
  // Previously the mutation called with CRYPTO_BTC but disabled checked predResult.crypto (BTC)
  // causing a mismatch. Now both use getWatchlistKey() so they always match.
  const getWatchlistKey = (result: any): string => {
    if (!result) return "";
    return result.stock ? result.stock : `CRYPTO_${result.crypto || result.cryptoSymbol}`;
  };

  const addToWatchlistMutation = useMutation({
    mutationFn: (watchlistKey: string) => {
      setAddingToWatchlist(watchlistKey);
      return apiRequest("POST", "/api/user/watchlist", { stock: watchlistKey });
    },
    onSuccess: (_, watchlistKey) => {
      toast({ title: "Added to Watchlist!", description: `${watchlistKey.replace("CRYPTO_", "")} is now being tracked.` });
      setAddedToWatchlist(prev => new Set([...prev, watchlistKey]));
      setAddingToWatchlist(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user/watchlist"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add to watchlist", variant: "destructive" });
      setAddingToWatchlist(null);
    },
  });

  if (isLoading || predsLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const getConfidenceColor = (c: number) => c >= 80 ? "bg-green-100 text-green-800" : c >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
  const getRiskColor = (r: string) => r === "low" ? "bg-green-100 text-green-800" : r === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
  const pastPredictions = (predictions as any[])?.filter((p: any) => !(activePredictions as any[])?.some((ap: any) => ap.id === p.id)) || [];

  const PredictionCard = ({ prediction, isPast = false }: { prediction: any; isPast?: boolean }) => {
    const midPrice = (prediction.predLow + prediction.predHigh) / 2;
    const isUptrend = midPrice > prediction.currentPrice;
    const wKey = prediction.stock;
    return (
      <Card className={`hover:shadow-lg transition-shadow ${isPast ? "opacity-80" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">{prediction.stock}</CardTitle>
            <div className="flex items-center space-x-2">
              {isUptrend ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
              <Badge className={getConfidenceColor(prediction.confidence)}>{prediction.confidence}% conf.</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge className={getRiskColor(prediction.riskLevel)}>{prediction.riskLevel} risk</Badge>
            <Badge variant="outline">{prediction.mode}</Badge>
            {isPast && <Badge variant="secondary"><Calendar className="h-3 w-3 mr-1" />Completed</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-sm text-center">
            <div><p className="text-gray-500">{isPast ? "Initial" : "Current"}</p><p className="font-semibold">₹{prediction.currentPrice?.toFixed(2)}</p></div>
            <div><p className="text-gray-500">Pred. Low</p><p className="font-semibold text-red-600">₹{prediction.predLow?.toFixed(2)}</p></div>
            <div><p className="text-gray-500">Pred. High</p><p className="font-semibold text-green-600">₹{prediction.predHigh?.toFixed(2)}</p></div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center"><Clock className="h-4 w-4 mr-1" />{new Date(prediction.createdAt).toLocaleDateString("en-IN")}</div>
            {prediction.targetDate && <div className="flex items-center"><Target className="h-4 w-4 mr-1" />{new Date(prediction.targetDate).toLocaleDateString("en-IN")}</div>}
          </div>
          {!isPast && (
            <Button size="sm"
              variant={addedToWatchlist.has(wKey) ? "default" : "outline"}
              className={`w-full gap-2 ${addedToWatchlist.has(wKey) ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
              onClick={() => addToWatchlistMutation.mutate(wKey)}
              disabled={addingToWatchlist === wKey || addedToWatchlist.has(wKey)}>
              {addingToWatchlist === wKey ? "Adding..." : addedToWatchlist.has(wKey) ? <><BookmarkCheck className="h-3 w-3" /> Added</> : "Add to Watchlist"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── FIX 1: Sliding toggle switch ──────────────────────────────────────────
  const PredTypeToggle = () => {
    const isStock = predType === "stock";
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Prediction Type</Label>
        <div
          className="relative flex items-center w-full rounded-xl border border-gray-200 bg-gray-100 p-1 cursor-pointer select-none"
          onClick={() => {
            const next = isStock ? "crypto" : "stock";
            setPredType(next as "stock" | "crypto");
            setSymbol(""); setSearchQuery(""); setSearchResults([]); setSearchAttempted(false);
          }}
        >
          {/* Animated sliding pill */}
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-sm transition-all duration-300 ease-in-out
            ${isStock ? "left-1 bg-blue-600" : "left-[calc(50%+3px)] bg-orange-500"}`}
          />
          <div className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors duration-300
            ${isStock ? "text-white" : "text-gray-400"}`}>
            <TrendingUp className="h-4 w-4" />
            Stocks
          </div>
          <div className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors duration-300
            ${!isStock ? "text-white" : "text-gray-400"}`}>
            <span className="text-base leading-none font-bold">₿</span>
            Crypto
          </div>
        </div>
        <p className="text-xs text-center text-gray-500">
          Predicting:{" "}
          <span className={`font-semibold ${isStock ? "text-blue-600" : "text-orange-500"}`}>
            {isStock ? "📈 Indian Stocks (NSE / BSE)" : "₿ Cryptocurrencies"}
          </span>
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="flex items-center">
          <ChevronLeft className="h-4 w-4 mr-1" />Back to Dashboard
        </Button>
        <div className="border-l pl-4">
          <h1 className="text-2xl font-bold text-gray-900">Predictions</h1>
          <p className="text-gray-600">Make AI-powered predictions for stocks and cryptocurrencies</p>
        </div>
      </div>

      <Tabs defaultValue="make" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="make"><Zap className="h-4 w-4 mr-1" />Make Prediction</TabsTrigger>
          <TabsTrigger value="active">Active ({(activePredictions as any[])?.length || 0})</TabsTrigger>
          <TabsTrigger value="past">Past ({pastPredictions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="make" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>New Prediction</CardTitle></CardHeader>
              <CardContent className="space-y-4">

                <PredTypeToggle />

                <div className="space-y-2">
                  <Label>{predType === "stock" ? "Search Stock (NSE/BSE)" : "Search Cryptocurrency"}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder={predType === "stock" ? "e.g. RELIANCE, TCS, INFY..." : "e.g. BTC, ETH, ADA..."}
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setSymbol(""); }}
                      className="pl-10" autoComplete="off"
                    />
                  </div>
                  {searchQuery.length > 1 && (
                    <div className="relative">
                      {isSearching ? (
                        <div className="border rounded-md p-3 bg-white shadow text-sm text-gray-500 flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />Searching...
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="absolute top-1 left-0 right-0 z-50 max-h-64 overflow-y-auto border rounded-md bg-white shadow-lg">
                          {searchResults.map((r: any) => (
                            <button key={r.symbol}
                              onClick={() => { setSymbol(r.symbol); setSearchQuery(r.symbol); setSearchResults([]); setSearchAttempted(false); }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center border-b last:border-b-0 text-sm">
                              <div><p className="font-medium">{r.symbol}</p><p className="text-gray-500 text-xs">{r.companyName || r.name}</p></div>
                              {r.lastPrice > 0 && <p className="font-medium">₹{r.lastPrice?.toFixed(2)}</p>}
                            </button>
                          ))}
                        </div>
                      ) : searchAttempted ? (
                        <div className="border rounded-md p-3 bg-white shadow text-sm text-gray-500 space-y-2">
                          <p>No results for "<strong>{searchQuery}</strong>"</p>
                          <Button size="sm" variant="outline" className="w-full text-xs"
                            onClick={() => { const s = searchQuery.trim().toUpperCase(); setSymbol(s); setSearchQuery(s); setSearchResults([]); setSearchAttempted(false); }}>
                            Use "{searchQuery.toUpperCase()}" directly anyway
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {symbol && <p className="text-xs text-green-600 font-medium">✅ Selected: {symbol}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Prediction Horizon</Label>
                  <Select value={horizon} onValueChange={setHorizon}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">1 Day</SelectItem>
                      <SelectItem value="1w">1 Week</SelectItem>
                      <SelectItem value="1m">1 Month</SelectItem>
                      <SelectItem value="3m">3 Months</SelectItem>
                      <SelectItem value="6m">6 Months</SelectItem>
                      <SelectItem value="1y">1 Year</SelectItem>
                      <SelectItem value="custom">Custom Date</SelectItem>
                    </SelectContent>
                  </Select>
                  {horizon === "custom" && (
                    <Input type="datetime-local" value={targetDate} onChange={e => setTargetDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Prediction Mode</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suggestion">AI + Astro Suggestion</SelectItem>
                      <SelectItem value="auto">Auto-Trading Signal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Risk Level</Label>
                  <Select value={riskLevel} onValueChange={setRiskLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Conservative (Low Risk)</SelectItem>
                      <SelectItem value="medium">Balanced (Medium Risk)</SelectItem>
                      <SelectItem value="high">Aggressive (High Risk)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" onClick={() => predictMutation.mutate()} disabled={!symbol || predictMutation.isPending}>
                  {predictMutation.isPending ? "Generating prediction..." :
                    `Predict ${symbol || "..."} for ${horizon === "custom" ? "custom date" : horizon === "1d" ? "tomorrow" : horizon === "1w" ? "next week" : horizon === "1m" ? "next month" : horizon === "3m" ? "3 months" : horizon === "6m" ? "6 months" : "next year"}`}
                </Button>
              </CardContent>
            </Card>

            {predResult ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{predResult.stock || predResult.crypto || predResult.cryptoSymbol} — Result</span>
                    {predResult.confidence && <Badge className={getConfidenceColor(predResult.confidence)}>{predResult.confidence?.toFixed(1)}% confidence</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {predResult.isBilling || predResult.paymentRequired ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">
                        <p className="font-semibold text-orange-900">Subscription Created</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">₹{predResult.billing?.finalBill}</p>
                        <p className="text-xs text-orange-500">Click below to get your prediction</p>
                      </div>
                      <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">Get Prediction →</Button>
                    </div>
                  ) : (
                    <>
                      {!predResult.aiPowered && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                          <p><strong>Estimated prices</strong> — Live market data for <strong>{predResult.stock}</strong> could not be fetched. Prices are model-based estimates.</p>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-gray-50 p-3 rounded"><p className="text-xs text-gray-500">Current Price</p><p className="font-bold">₹{predResult.currentPrice?.toFixed(2)}</p></div>
                        <div className="bg-red-50 p-3 rounded"><p className="text-xs text-gray-500">Target Low</p><p className="font-bold text-red-600">₹{predResult.predLow?.toFixed(2)}</p></div>
                        <div className="bg-green-50 p-3 rounded"><p className="text-xs text-gray-500">Target High</p><p className="font-bold text-green-600">₹{predResult.predHigh?.toFixed(2)}</p></div>
                      </div>
                      {predResult.recommendation && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800"><strong>Recommendation:</strong> {predResult.recommendation}</p>
                        </div>
                      )}
                      {predResult.direction && (
                        <div className="flex items-center gap-2">
                          {predResult.direction === "bullish" ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                          <span className="text-sm capitalize font-medium">{predResult.direction} outlook</span>
                        </div>
                      )}

                      {/* ── FIX 2: Watchlist button with consistent key ── */}
                      {(() => {
                        const wKey = getWatchlistKey(predResult);
                        const isAdded = addedToWatchlist.has(wKey);
                        const isAdding = addingToWatchlist === wKey;
                        return (
                          <Button
                            variant={isAdded ? "default" : "outline"}
                            className={`w-full gap-2 ${isAdded ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                            onClick={() => addToWatchlistMutation.mutate(wKey)}
                            disabled={isAdding || isAdded}
                          >
                            {isAdding
                              ? <><div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> Adding...</>
                              : isAdded
                              ? <><BookmarkCheck className="h-4 w-4" /> Added to Watchlist</>
                              : <><BookmarkPlus className="h-4 w-4" /> Add to Watchlist</>}
                          </Button>
                        );
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="flex flex-col items-center justify-center p-12 text-center text-gray-400 border-dashed">
                <Zap className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm font-medium">Your prediction result will appear here</p>
                <p className="text-xs mt-1">Select a symbol and click Generate</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          {(activePredictions as any[])?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(activePredictions as any[]).map((p: any) => <PredictionCard key={p.id} prediction={p} />)}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto"><Clock className="h-8 w-8 text-primary" /></div>
                <h3 className="text-lg font-semibold">No Active Predictions</h3>
                <p className="text-gray-600">Go to Make Prediction tab to create your first prediction.</p>
                <Button onClick={() => setActiveTab("make")}>Make a Prediction</Button>
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
                <h3 className="text-lg font-semibold">No Past Predictions</h3>
                <p className="text-gray-600">Completed predictions will appear here.</p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <FeedbackForm />
    </div>
  );
}
