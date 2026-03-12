
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, Download, Filter, TrendingUp, TrendingDown, Bitcoin } from "lucide-react";
import { useLocation } from "wouter";

export default function TradingHistoryPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState('all');

  const trades = [
    // Stock trades
    {
      id: 1,
      symbol: 'RELIANCE',
      name: 'Reliance Industries',
      type: 'BUY',
      quantity: 50,
      price: 2456.80,
      currentPrice: 2587.20,
      date: '2024-01-15',
      status: 'ACTIVE',
      pnl: +6521.00,
      pnlPercent: +5.31,
      category: 'stock',
      currency: '₹'
    },
    {
      id: 2,
      symbol: 'TCS',
      name: 'Tata Consultancy Services',
      type: 'SELL',
      quantity: 25,
      price: 3892.50,
      currentPrice: 3845.30,
      date: '2024-01-14',
      status: 'CLOSED',
      pnl: +1181.25,
      pnlPercent: +1.21,
      category: 'stock',
      currency: '₹'
    },
    {
      id: 3,
      symbol: 'HDFCBANK',
      name: 'HDFC Bank',
      type: 'BUY',
      quantity: 30,
      price: 1675.25,
      currentPrice: 1642.80,
      date: '2024-01-12',
      status: 'ACTIVE',
      pnl: -973.50,
      pnlPercent: -1.94,
      category: 'stock',
      currency: '₹'
    },
    {
      id: 4,
      symbol: 'INFY',
      name: 'Infosys',
      type: 'BUY',
      quantity: 40,
      price: 1789.60,
      currentPrice: 1823.45,
      date: '2024-01-10',
      status: 'ACTIVE',
      pnl: +1354.00,
      pnlPercent: +1.89,
      category: 'stock',
      currency: '₹'
    },
    {
      id: 5,
      symbol: 'SUZLON',
      name: 'Suzlon Energy',
      type: 'BUY',
      quantity: 200,
      price: 48.75,
      currentPrice: 54.20,
      date: '2024-01-08',
      status: 'CLOSED',
      pnl: +1090.00,
      pnlPercent: +11.18,
      category: 'stock',
      currency: '₹'
    },
    // Crypto trades
    {
      id: 6,
      symbol: 'BTC',
      name: 'Bitcoin',
      type: 'BUY',
      quantity: 0.5,
      price: 45250.80,
      currentPrice: 47890.25,
      date: '2024-01-15',
      status: 'ACTIVE',
      pnl: +1319.73,
      pnlPercent: +5.83,
      category: 'crypto',
      currency: '$'
    },
    {
      id: 7,
      symbol: 'ETH',
      name: 'Ethereum',
      type: 'SELL',
      quantity: 2.5,
      price: 2890.50,
      currentPrice: 2756.30,
      date: '2024-01-14',
      status: 'CLOSED',
      pnl: +335.50,
      pnlPercent: +4.64,
      category: 'crypto',
      currency: '$'
    },
    {
      id: 8,
      symbol: 'ADA',
      name: 'Cardano',
      type: 'BUY',
      quantity: 1000,
      price: 0.485,
      currentPrice: 0.452,
      date: '2024-01-12',
      status: 'ACTIVE',
      pnl: -33.00,
      pnlPercent: -6.80,
      category: 'crypto',
      currency: '$'
    },
    {
      id: 9,
      symbol: 'SOL',
      name: 'Solana',
      type: 'BUY',
      quantity: 10,
      price: 89.60,
      currentPrice: 98.45,
      date: '2024-01-10',
      status: 'ACTIVE',
      pnl: +88.50,
      pnlPercent: +9.87,
      category: 'crypto',
      currency: '$'
    }
  ];

  const filteredTrades = filter === 'all' ? trades : 
    filter === 'stock' || filter === 'crypto' ? trades.filter(trade => trade.category === filter) :
    trades.filter(trade => trade.status.toLowerCase() === filter);

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

  const getPnLDisplay = (pnl: number, pnlPercent: number, currency: string) => {
    const isPositive = pnl > 0;
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    const icon = isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
    
    return (
      <div className={`flex items-center space-x-1 ${color}`}>
        {icon}
        <span className="font-semibold">
          {currency}{Math.abs(pnl).toLocaleString(currency === '$' ? 'en-US' : 'en-IN')}
        </span>
        <span className="text-sm">
          ({isPositive ? '+' : '-'}{Math.abs(pnlPercent).toFixed(2)}%)
        </span>
      </div>
    );
  };

  const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const activeTrades = trades.filter(trade => trade.status === 'ACTIVE').length;
  const totalTrades = trades.length;
  const winRate = ((trades.filter(trade => trade.pnl > 0).length / totalTrades) * 100).toFixed(1);

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
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">Trading History</h1>
            <p className="text-gray-600" data-testid="text-page-description">
              Track your trading performance and history
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Filter className="h-4 w-4 text-gray-500" />
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="all">All Trades</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="stock">Stocks Only</option>
            <option value="crypto">Crypto Only</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL > 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{totalPnL.toLocaleString('en-IN')}
            </div>
            <p className="text-sm text-gray-500">All time</p>
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
            <div className="text-2xl font-bold text-gray-900">{totalTrades}</div>
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

      <Tabs defaultValue="table" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="charts">Performance Charts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
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
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {trade.category === 'crypto' ? (
                            <Bitcoin className="h-4 w-4 text-orange-500" />
                          ) : (
                            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                          )}
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
                      <TableCell>{trade.currency}{trade.price.toLocaleString(trade.currency === '$' ? 'en-US' : 'en-IN')}</TableCell>
                      <TableCell>{trade.currency}{trade.currentPrice.toLocaleString(trade.currency === '$' ? 'en-US' : 'en-IN')}</TableCell>
                      <TableCell>{new Date(trade.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{getStatusBadge(trade.status)}</TableCell>
                      <TableCell>{getPnLDisplay(trade.pnl, trade.pnlPercent, trade.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="charts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>P&L Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  P&L Chart will be rendered here
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Trade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  Trade Distribution Chart will be rendered here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
