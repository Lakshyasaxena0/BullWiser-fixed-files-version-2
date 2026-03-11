import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketOverviewProps {
  marketData?: any;
}

export default function MarketOverview({ marketData }: MarketOverviewProps) {
  // Default data if API fails
  const indices = marketData?.indices || {
    nifty50: { value: 19745.20, change: 1.24 },
    sensex: { value: 66598.91, change: 0.89 },
    bankNifty: { value: 45123.45, change: -0.45 }
  };

  const trending = marketData?.trending || [
    { symbol: 'RELIANCE', price: 2543.20, change: 2.1 },
    { symbol: 'TCS', price: 3876.55, change: 1.8 },
    { symbol: 'HDFC', price: 1645.30, change: -0.5 },
    { symbol: 'INFY', price: 1423.75, change: 1.2 },
    { symbol: 'ICICIBANK', price: 912.40, change: 0.8 },
    { symbol: 'HDFCBANK', price: 1587.20, change: -0.3 },
    { symbol: 'SBIN', price: 542.35, change: 1.5 },
    { symbol: 'BHARTIARTL', price: 863.90, change: 0.6 },
    { symbol: 'ITC', price: 412.80, change: -0.2 },
    { symbol: 'KOTAKBANK', price: 1734.50, change: 0.9 },
    { symbol: 'LT', price: 2987.30, change: 1.1 },
    { symbol: 'HCLTECH', price: 1256.40, change: 0.7 },
    { symbol: 'WIPRO', price: 424.60, change: -0.4 },
    { symbol: 'MARUTI', price: 9876.50, change: 1.3 },
    { symbol: 'BAJFINANCE', price: 6543.20, change: 0.5 },
    { symbol: 'AXISBANK', price: 987.60, change: -0.1 },
    { symbol: 'ULTRACEMCO', price: 8765.40, change: 0.8 },
    { symbol: 'NESTLEIND', price: 19876.30, change: 0.4 },
    { symbol: 'TITAN', price: 2876.90, change: 1.0 },
    { symbol: 'SUNPHARMA', price: 1098.50, change: -0.6 }
  ];

  const getChangeColor = (change: number) => {
    return change >= 0 ? "text-green-600" : "text-red-600";
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getCompanyInitial = (symbol: string) => {
    return symbol.charAt(0);
  };

  const getCompanyColor = (symbol: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-red-500', 'bg-yellow-500', 'bg-indigo-500'
    ];
    const index = symbol.length % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-6">
      {/* Market Summary */}
      <Card className="shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold" data-testid="text-market-overview-title">
            Market Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">NIFTY 50</span>
            <div className="text-right flex items-center space-x-2">
              <span className="font-semibold text-gray-900" data-testid="text-nifty-value">
                {indices.nifty50.value.toLocaleString()}
              </span>
              <Badge 
                className={`${getChangeColor(indices.nifty50.change)} bg-transparent border-0 p-0 text-sm`}
                data-testid="badge-nifty-change"
              >
                {getChangeIcon(indices.nifty50.change)}
                {indices.nifty50.change > 0 ? '+' : ''}{indices.nifty50.change}%
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">SENSEX</span>
            <div className="text-right flex items-center space-x-2">
              <span className="font-semibold text-gray-900" data-testid="text-sensex-value">
                {indices.sensex.value.toLocaleString()}
              </span>
              <Badge 
                className={`${getChangeColor(indices.sensex.change)} bg-transparent border-0 p-0 text-sm`}
                data-testid="badge-sensex-change"
              >
                {getChangeIcon(indices.sensex.change)}
                {indices.sensex.change > 0 ? '+' : ''}{indices.sensex.change}%
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Bank NIFTY</span>
            <div className="text-right flex items-center space-x-2">
              <span className="font-semibold text-gray-900" data-testid="text-bank-nifty-value">
                {indices.bankNifty.value.toLocaleString()}
              </span>
              <Badge 
                className={`${getChangeColor(indices.bankNifty.change)} bg-transparent border-0 p-0 text-sm`}
                data-testid="badge-bank-nifty-change"
              >
                {getChangeIcon(indices.bankNifty.change)}
                {indices.bankNifty.change > 0 ? '+' : ''}{indices.bankNifty.change}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trending Stocks */}
      <Card className="shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold" data-testid="text-trending-title">
            Trending Stocks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-3 overflow-x-auto scrollbar-hide pb-2">
            {trending.slice(0, 10).map((stock: any, index: number) => (
              <div key={stock.symbol} className="flex-shrink-0 bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors min-w-[140px]">
                <div className="flex flex-col items-center space-y-2">
                  <div className={`w-8 h-8 ${getCompanyColor(stock.symbol)} rounded-full flex items-center justify-center text-white text-sm font-semibold`}>
                    {getCompanyInitial(stock.symbol)}
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900 text-sm truncate" data-testid={`text-trending-symbol-${index}`}>
                      {stock.symbol}
                    </p>
                    <p className="text-xs text-gray-500" data-testid={`text-trending-price-${index}`}>
                      ₹{stock.price.toFixed(2)}
                    </p>
                  </div>
                  <Badge 
                    className={`${getChangeColor(stock.change)} bg-transparent border-0 p-0 text-xs font-medium`}
                    data-testid={`badge-trending-change-${index}`}
                  >
                    {getChangeIcon(stock.change)}
                    {stock.change > 0 ? '+' : ''}{stock.change}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
