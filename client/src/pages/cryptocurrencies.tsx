import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Bitcoin, Search, Clock, Target, Eye, ChevronLeft, Download, Filter } from "lucide-react";
import { useLocation } from "wouter";

// Component to display selected crypto with live data
function SelectedCryptoCard({ cryptoSymbol }: { cryptoSymbol: string }) {
  const { data: cryptoData, isLoading } = useQuery({
    queryKey: [`/api/crypto/quote/${cryptoSymbol}`],
    enabled: !!cryptoSymbol,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
  });

  if (isLoading) {
    return (
      <div className="mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
        <div className="flex items-center justify-center">
          <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full mr-2" />
          <span className="text-sm text-gray-600">Loading {cryptoSymbol} data...</span>
        </div>
      </div>
    );
  }

  if (!cryptoData) {
    return (
      <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
        <span className="text-sm text-red-700">Unable to load data for {cryptoSymbol}</span>
      </div>
    );
  }

  const isPositiveChange = cryptoData.changePercent24h >= 0;

  return (
    <div className="mt-2 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg text-gray-900">{cryptoData.symbol}</h3>
          <p className="text-sm text-gray-600">{cryptoData.name}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            ${cryptoData.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className={`flex items-center justify-end ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
            {isPositiveChange ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            <span className="font-medium">
              {isPositiveChange ? '+' : ''}${Math.abs(cryptoData.change24h).toFixed(2)}
            </span>
            <span className="ml-1">
              ({isPositiveChange ? '+' : ''}{cryptoData.changePercent24h.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">24h High</p>
          <p className="font-semibold text-green-600">
            ${cryptoData.high24h?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">24h Low</p>
          <p className="font-semibold text-red-600">
            ${cryptoData.low24h?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">24h Volume</p>
          <p className="font-semibold text-blue-600">
            ${(cryptoData.volume24h / 1e9).toFixed(2)}B
          </p>
        </div>
        <div>
          <p className="text-gray-500">Market Cap</p>
          <p className="font-semibold text-purple-600">
            ${(cryptoData.marketCap / 1e9).toFixed(2)}B
          </p>
        </div>
      </div>

      {cryptoData.astrologyBias && process.env.NODE_ENV === 'development' && (
        <div className="mt-3 pt-3 border-t border-orange-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Astro Influence: {cryptoData.horaInfluence}</span>
            <span className={`font-medium ${cryptoData.astrologyBias > 0 ? 'text-green-600' : 'text-red-600'}`}>
              Bias: {cryptoData.astrologyBias > 0 ? '+' : ''}{cryptoData.astrologyBias}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Cryptocurrencies() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [cryptoSymbol, setCryptoSymbol] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [predictionTime, setPredictionTime] = useState('');
  const [mode, setMode] = useState('suggestion');
  const [riskLevel, setRiskLevel] = useState('high');
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("predict");
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [tradingFilter, setTradingFilter] = useState('all');
  const queryClient = useQueryClient();

  // For search functionality
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // Search cryptos
  // const { data: searchResults, isLoading: searchLoading } = useQuery({
  //   queryKey: ["/api/search/crypto", searchQuery],
  //   enabled: searchQuery.length > 1,
  //   staleTime: 30000,
  // });

  // Use local state and effect for search to allow for better error handling and debugging
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length > 1) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300); // Debounce delay

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search/crypto?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const results = await response.json();
        console.log('Search results for', query, ':', results); // Debug log
        setSearchResults(results || []);
      } else {
        console.error('Search failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Get crypto overview
  const { data: cryptoOverview } = useQuery({
    queryKey: ["/api/crypto/overview"],
    staleTime: 60000,
  });

  // Get crypto predictions
  const { data: cryptoPredictions } = useQuery({
    queryKey: ["/api/user/predictions"],
    enabled: isAuthenticated,
  });

  // Crypto prediction mutation - now creates billing first
  const predictMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/crypto/predict", data);
    },
    onSuccess: (data) => {
      if (data.billCreated && data.paymentRequired) {
        // Show billing information instead of prediction
        setPredictionResult({
          ...data,
          isBilling: true
        });
        toast({
          title: "Bill Created",
          description: `Payment of ₹${data.billing.finalBill} required for ${data.cryptoSymbol} prediction`,
          variant: "default",
        });
      } else {
        // This shouldn't happen with the new flow, but keeping as fallback
        setPredictionResult(data);
        toast({
          title: "Prediction Generated!",
          description: `${data.crypto} prediction completed with ${data.confidence}% confidence`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/user/predictions"] });
      }
    },
    onError: (error: any) => {
      if (error.subscriptionType === 'crypto') {
        toast({
          title: "Subscription Required",
          description: "You need an active crypto subscription to generate predictions. Redirecting to plans...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation('/crypto-plans');
        }, 2000);
      } else {
        toast({
          title: "Prediction Failed",
          description: error.message || "Failed to generate crypto prediction",
          variant: "destructive",
        });
      }
    },
  });

  // New mutation to generate prediction after payment
  const generatePredictionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/crypto/predict/generate", data);
    },
    onSuccess: (data) => {
      setPredictionResult(data);
      toast({
        title: "Prediction Generated!",
        description: `${data.crypto} prediction completed with ${data.confidence}% confidence`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/predictions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Prediction Failed",
        description: error.message || "Failed to generate crypto prediction",
        variant: "destructive",
      });
    },
  });

  // Add to watchlist mutation
  const watchlistMutation = useMutation({
    mutationFn: (crypto: string) => {
      setAddingToWatchlist(true);
      return apiRequest('POST', '/api/user/watchlist', { stock: `CRYPTO_${crypto}` });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Cryptocurrency added to watchlist successfully!",
      });
      setAddingToWatchlist(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user/watchlist"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add cryptocurrency to watchlist",
        variant: "destructive",
      });
      setAddingToWatchlist(false);
    },
  });

  const handleGeneratePrediction = () => {
    predictMutation.mutate({
      crypto: cryptoSymbol,
      when: predictionTime || 'now',
      mode,
      riskLevel,
      tradesPerDay: 1,
      cryptoValue: 10000, // Default crypto value for billing
      duration: 'daily', // Default duration
      referralCount: 0
    });
  };

  const handlePayAndGenerate = () => {
    if (predictionResult?.subscriptionId) {
      generatePredictionMutation.mutate({
        subscriptionId: predictionResult.subscriptionId,
        crypto: predictionResult.cryptoSymbol,
        when: predictionTime || 'now'
      });
    }
  };

  const handleAddToWatchlist = () => {
    if (predictionResult) {
      watchlistMutation.mutate(predictionResult.crypto);
    }
  };

  const handleSearchSelect = (crypto: any) => {
    setCryptoSymbol(crypto.symbol);
    setSearchQuery(''); // Clear search to hide dropdown
    setSearchResults([]); // Clear search results
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Mock crypto trading data
  const cryptoTrades = [
    {
      id: 1,
      symbol: 'BTC',
      name: 'Bitcoin',
      type: 'BUY',
      quantity: 0.5,
      price: 45250.80,
      currentPrice: 47890.25,
      date: '2024-01-15',
      status: 'ACTIVE',
      pnl: +1319.73,
      pnlPercent: +5.83
    },
    {
      id: 2,
      symbol: 'ETH',
      name: 'Ethereum',
      type: 'SELL',
      quantity: 2.5,
      price: 2890.50,
      currentPrice: 2756.30,
      date: '2024-01-14',
      status: 'CLOSED',
      pnl: +335.50,
      pnlPercent: +4.64
    },
    {
      id: 3,
      symbol: 'ADA',
      name: 'Cardano',
      type: 'BUY',
      quantity: 1000,
      price: 0.485,
      currentPrice: 0.452,
      date: '2024-01-12',
      status: 'ACTIVE',
      pnl: -33.00,
      pnlPercent: -6.80
    },
    {
      id: 4,
      symbol: 'SOL',
      name: 'Solana',
      type: 'BUY',
      quantity: 10,
      price: 89.60,
      currentPrice: 98.45,
      date: '2024-01-10',
      status: 'ACTIVE',
      pnl: +88.50,
      pnlPercent: +9.87
    }
  ];

  // Filter crypto predictions from all predictions
  const activeCryptoPredictions = cryptoPredictions?.filter((p: any) => 
    p.stock.startsWith('CRYPTO_')
  ) || [];

  const filteredTrades = tradingFilter === 'all' ? cryptoTrades : cryptoTrades.filter(trade => trade.status.toLowerCase() === tradingFilter);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "bg-green-100 text-green-800";
    if (confidence >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Active</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Closed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getPnLDisplay = (pnl: number, pnlPercent: number) => {
    const isPositive = pnl > 0;
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    const icon = isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;

    return (
      <div className={`flex items-center space-x-1 ${color}`}>
        {icon}
        <span className="font-semibold">
          ${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
        <span className="text-sm">
          ({isPositive ? '+' : '-'}{Math.abs(pnlPercent).toFixed(2)}%)
        </span>
      </div>
    );
  };

  const totalPnL = cryptoTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const activeTrades = cryptoTrades.filter(trade => trade.status === 'ACTIVE').length;
  const totalTrades = cryptoTrades.length;
  const winRate = ((cryptoTrades.filter(trade => trade.pnl > 0).length / totalTrades) * 100).toFixed(1);

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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center" data-testid="text-page-title">
              <Bitcoin className="h-6 w-6 mr-2 text-orange-500" />
              Cryptocurrencies
            </h1>
            <p className="text-gray-600" data-testid="text-page-description">
              AI-powered cryptocurrency predictions, trading history, and portfolio management
            </p>
          </div>
        </div>
        <Button
          onClick={() => setLocation('/crypto-plans')}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Bitcoin className="h-4 w-4 mr-1" />
          Crypto Plans
        </Button>
      </div>

      {/* Crypto Market Overview */}
      {cryptoOverview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Market Cap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ${(cryptoOverview.totalMarketCap / 1e12).toFixed(2)}T
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">24h Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                ${(cryptoOverview.totalVolume / 1e9).toFixed(0)}B
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalPnL > 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {activeCryptoPredictions.length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="predict" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="predict" data-testid="tab-predict">
            Predictions
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({activeCryptoPredictions.length})
          </TabsTrigger>
          <TabsTrigger value="trading" data-testid="tab-trading">
            Trading History
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predict" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prediction Form */}
            <Card>
              <CardHeader>
                <CardTitle data-testid="text-prediction-form-title">Generate Crypto Prediction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="searchCrypto">Search Cryptocurrency</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="searchCrypto"
                      type="text"
                      placeholder="Search crypto (e.g., BTC, ETH, ADA)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-crypto-search"
                      autoComplete="off"
                    />
                  </div>

                  {/* Enhanced Search Results Dropdown */}
                  {searchQuery.length > 0 && (
                    <div className="relative">
                      {isSearching ? (
                        <div className="mt-2 p-4 border border-gray-200 rounded-md bg-white shadow-lg">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full mr-2" />
                            <span className="text-sm text-gray-600">Searching cryptocurrencies...</span>
                          </div>
                        </div>
                      ) : searchResults && searchResults.length > 0 ? (
                        <div className="absolute top-2 left-0 right-0 z-50 max-h-80 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                          <div className="p-2 border-b border-gray-100 bg-gray-50">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {searchResults.length} Cryptocurrency{searchResults.length !== 1 ? 's' : ''} Found
                            </span>
                          </div>
                          {searchResults.map((crypto: any, index: number) => (
                            <button
                              key={crypto.symbol}
                              onClick={() => handleSearchSelect(crypto)}
                              className="w-full px-4 py-3 text-left hover:bg-orange-50 flex justify-between items-center border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                              data-testid={`search-result-${crypto.symbol}`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-bold text-orange-600">
                                    {crypto.symbol.substring(0, 2)}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{crypto.symbol}</div>
                                  <div className="text-sm text-gray-500">{crypto.name}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-900">
                                  ${crypto.lastPrice.toLocaleString('en-US', { 
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: crypto.lastPrice < 1 ? 6 : 2 
                                  })}
                                </div>
                                <div className={`text-xs flex items-center justify-end ${crypto.changePercent24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {crypto.changePercent24h >= 0 ? (
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                  )}
                                  {crypto.changePercent24h >= 0 ? '+' : ''}{crypto.changePercent24h.toFixed(2)}%
                                </div>
                              </div>
                            </button>
                          ))}
                          <div className="p-2 bg-gray-50 border-t border-gray-100">
                            <span className="text-xs text-gray-500">
                              Click on a cryptocurrency to select and view live data
                            </span>
                          </div>
                        </div>
                      ) : searchQuery.length > 1 ? (
                        <div className="absolute top-2 left-0 right-0 z-50 p-4 border border-gray-200 rounded-md bg-white shadow-lg">
                          <div className="text-center text-gray-500">
                            <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            <div className="text-sm">No cryptocurrencies found for "{searchQuery}"</div>
                            <div className="text-xs text-gray-400 mt-1">
                              Try searching for BTC, ETH, ADA, or other popular cryptos
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Selected Crypto Display with Live Data */}
                  {cryptoSymbol && (
                    <SelectedCryptoCard cryptoSymbol={cryptoSymbol} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="predictionTime">Prediction Time (Optional)</Label>
                  <Input
                    id="predictionTime"
                    type="datetime-local"
                    value={predictionTime}
                    onChange={(e) => setPredictionTime(e.target.value)}
                    data-testid="input-prediction-time"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mode">Prediction Mode</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger data-testid="select-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suggestion">AI + Astro Suggestion</SelectItem>
                      <SelectItem value="auto">Auto-Trading Signal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="riskLevel">Risk Level</Label>
                  <Select value={riskLevel} onValueChange={setRiskLevel}>
                    <SelectTrigger data-testid="select-risk">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="extreme">Extreme Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleGeneratePrediction}
                  disabled={!cryptoSymbol || predictMutation.isPending}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  data-testid="button-generate-prediction"
                >
                  {predictMutation.isPending ? "Generating..." : "Generate Crypto Prediction"}
                </Button>
              </CardContent>
            </Card>

            {/* Prediction Result or Billing */}
            {predictionResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {predictionResult.isBilling ? (
                      <span data-testid="text-billing-title">
                        {predictionResult.cryptoSymbol} Prediction Billing
                      </span>
                    ) : (
                      <span data-testid="text-result-title">
                        {predictionResult.crypto} Prediction
                      </span>
                    )}
                    {!predictionResult.isBilling && (
                      <div className="flex items-center space-x-2">
                        {getDirectionIcon(predictionResult.direction)}
                        <Badge className={getConfidenceColor(predictionResult.confidence)}>
                          {predictionResult.confidence}% confidence
                        </Badge>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {predictionResult.isBilling ? (
                    /* Billing Display */
                    <div className="space-y-4">
                      <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <h3 className="text-lg font-semibold text-orange-900 mb-2">
                          Payment Required
                        </h3>
                        <p className="text-sm text-orange-700 mb-3">
                          {predictionResult.message}
                        </p>
                        <div className="text-2xl font-bold text-orange-600">
                          ₹{predictionResult.billing?.finalBill?.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Cryptocurrency</p>
                          <p className="font-semibold">{predictionResult.cryptoSymbol}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Current Price</p>
                          <p className="font-semibold">${predictionResult.currentPrice?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Base Price</p>
                          <p className="font-semibold">₹{predictionResult.billing?.basePrice}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Final Amount</p>
                          <p className="font-semibold text-orange-600">₹{predictionResult.billing?.finalBill}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-700">
                          <strong>What you get:</strong> AI-powered cryptocurrency prediction with astrology insights, 
                          price targets, confidence levels, and trading recommendations.
                        </p>
                      </div>

                      <Button 
                        onClick={handlePayAndGenerate}
                        disabled={generatePredictionMutation.isPending}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        data-testid="button-pay-generate"
                      >
                        {generatePredictionMutation.isPending ? "Processing Payment & Generating..." : `Pay ₹${predictionResult.billing?.finalBill} & Get Prediction`}
                      </Button>
                    </div>
                  ) : (
                    /* Prediction Display */
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Current Price</p>
                          <p className="text-lg font-bold">${predictionResult.currentPrice}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Target Low</p>
                          <p className="text-lg font-bold text-red-600">${predictionResult.predLow}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Target High</p>
                          <p className="text-lg font-bold text-green-600">${predictionResult.predHigh}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">
                          <strong>Recommendation:</strong> {predictionResult.recommendation}
                        </p>
                      </div>

                      <div className="flex space-x-2">
                        <Button 
                          onClick={handleAddToWatchlist}
                          disabled={addingToWatchlist}
                          variant="outline"
                          className="flex-1"
                          data-testid="button-add-watchlist"
                        >
                          {addingToWatchlist ? "Adding..." : "Add to Watchlist"}
                        </Button>
                        <Button className="flex-1" data-testid="button-set-alert">
                          Set Price Alert
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          {activeCryptoPredictions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCryptoPredictions.map((prediction: any) => {
                const cryptoSymbol = prediction.stock.replace('CRYPTO_', '');
                const midPrice = (prediction.predLow + prediction.predHigh) / 2;
                const isUptrend = midPrice > prediction.currentPrice;

                return (
                  <Card key={prediction.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold flex items-center">
                          <Bitcoin className="h-4 w-4 mr-1 text-orange-500" />
                          {cryptoSymbol}
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                          {isUptrend ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <Badge className={getConfidenceColor(prediction.confidence)}>
                            {prediction.confidence}%
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <p className="text-gray-500">Current</p>
                          <p className="font-semibold">${prediction.currentPrice}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Low</p>
                          <p className="font-semibold text-red-600">${prediction.predLow}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">High</p>
                          <p className="font-semibold text-green-600">${prediction.predHigh}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{new Date(prediction.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <Button size="sm" variant="outline" className="w-full">
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                  <Bitcoin className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">No Active Crypto Predictions</h3>
                <p className="text-gray-600">
                  Generate cryptocurrency predictions to start tracking their performance.
                </p>
                <Button onClick={() => setActiveTab("predict")}>
                  Create Crypto Prediction
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trading" className="mt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Trading History</h2>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Filter className="h-4 w-4 text-gray-500" />
              <select 
                value={tradingFilter} 
                onChange={(e) => setTradingFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Trades</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cryptocurrency</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Bitcoin className="h-4 w-4 text-orange-500" />
                          <div>
                            <div className="font-medium">{trade.symbol}</div>
                            <div className="text-sm text-gray-500">{trade.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={trade.type === 'BUY' ? 'default' : 'secondary'}>
                          {trade.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{trade.quantity}</TableCell>
                      <TableCell>${trade.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>${trade.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{new Date(trade.date).toLocaleDateString('en-US')}</TableCell>
                      <TableCell>{getStatusBadge(trade.status)}</TableCell>
                      <TableCell>{getPnLDisplay(trade.pnl, trade.pnlPercent)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalPnL > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-sm text-gray-500">All time crypto</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Active Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{activeTrades}</div>
                <p className="text-sm text-gray-500">Currently open</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{totalTrades}</div>
                <p className="text-sm text-gray-500">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{winRate}%</div>
                <p className="text-sm text-gray-500">Success rate</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Crypto P&L Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  Cryptocurrency P&L Chart will be rendered here
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Cryptocurrencies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cryptoTrades.filter(t => t.pnl > 0).sort((a, b) => b.pnlPercent - a.pnlPercent).slice(0, 3).map((trade) => (
                    <div key={trade.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Bitcoin className="h-6 w-6 text-orange-500" />
                        <div>
                          <div className="font-medium">{trade.symbol}</div>
                          <div className="text-sm text-gray-500">{trade.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-600 font-medium">+{trade.pnlPercent.toFixed(2)}%</div>
                        <div className="text-sm text-gray-500">${trade.pnl.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}