import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

declare global {
  interface Window {
    Chart: any;
  }
}

export default function Charts() {
  const accuracyChartRef = useRef<HTMLCanvasElement>(null);
  const portfolioChartRef = useRef<HTMLCanvasElement>(null);
  const accuracyChartInstance = useRef<any>(null);
  const portfolioChartInstance = useRef<any>(null);

  // State for the selected periods
  const [predictionPeriod, setPredictionPeriod] = useState("30days");
  const [portfolioPeriod, setPortfolioPeriod] = useState("7days");

  // Fetch real market data
  const { data: marketData } = useQuery({
    queryKey: ["/api/market/overview"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch historical data for portfolio
  const { data: historicalData } = useQuery({
    queryKey: ["/api/stock/NIFTY50/history", { days: portfolioPeriod === "7days" ? 7 : 30 }],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch prediction accuracy data
  const { data: predictionStats } = useQuery({
    queryKey: ["/api/user/predictions/stats"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  useEffect(() => {
    // Load Chart.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => {
      initializeCharts();
    };
    document.head.appendChild(script);

    return () => {
      if (accuracyChartInstance.current) {
        accuracyChartInstance.current.destroy();
      }
      if (portfolioChartInstance.current) {
        portfolioChartInstance.current.destroy();
      }
      // Remove the script if it's still in the head
      const existingScript = document.querySelector('script[src="https://cdn.jsdelivr.net/npm/chart.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  // Re-initialize charts when data changes
  useEffect(() => {
    if (window.Chart && (predictionStats || historicalData)) {
      initializeCharts();
    }
  }, [predictionStats, historicalData, predictionPeriod, portfolioPeriod]);

  const initializeCharts = () => {
    if (!window.Chart) return;

    // Destroy existing chart instances
    if (accuracyChartInstance.current) {
      accuracyChartInstance.current.destroy();
    }
    if (portfolioChartInstance.current) {
      portfolioChartInstance.current.destroy();
    }

    // Prepare accuracy chart data
    const accuracyLabels = predictionStats?.weeklyAccuracy?.map((item: any) => item.week) || ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const accuracyData = predictionStats?.weeklyAccuracy?.map((item: any) => item.accuracy) || [82, 85, 87, 89];

    // Accuracy Chart
    if (accuracyChartRef.current) {
      const ctx = accuracyChartRef.current.getContext('2d');
      if (ctx) {
        accuracyChartInstance.current = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels: accuracyLabels,
            datasets: [{
              label: 'Prediction Accuracy',
              data: accuracyData,
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  callback: function(value: any) {
                    return value + '%';
                  }
                }
              },
              x: {
                grid: { display: false }
              }
            }
          }
        });
      }
    }

    // Prepare portfolio chart data from historical data
    const portfolioLabels = historicalData?.slice(-7).map((item: any) => {
      const date = new Date(item.date || item.CH_TIMESTAMP);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }) || ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
    
    const portfolioData = historicalData?.slice(-7).map((item: any) => item.close || item.CH_CLOSING_PRICE) || [245000, 246500, 244800, 247200, 248900, 245890, 247100];

    // Portfolio Chart
    if (portfolioChartRef.current) {
      const ctx = portfolioChartRef.current.getContext('2d');
      if (ctx) {
        portfolioChartInstance.current = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels: portfolioLabels,
            datasets: [{
              label: 'Portfolio Value',
              data: portfolioData,
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                ticks: {
                  callback: function(value: any) {
                    return '₹' + (value/1000) + 'K';
                  }
                }
              },
              x: {
                grid: { display: false }
              }
            }
          }
        });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Prediction Accuracy Chart */}
      <Card className="shadow-sm border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold" data-testid="text-accuracy-chart-title">
                Prediction Accuracy
              </CardTitle>
              <CardDescription>
                Model performance over time
              </CardDescription>
            </div>
            <Select value={predictionPeriod} onValueChange={setPredictionPeriod}>
              <SelectTrigger className="w-32 bg-white/80 backdrop-blur-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-sm">
                <SelectItem value="1week">1 Week</SelectItem>
                <SelectItem value="2week">2 Weeks</SelectItem>
                <SelectItem value="3week">3 Weeks</SelectItem>
                <SelectItem value="1month">1 Month</SelectItem>
                <SelectItem value="3months">3 Months</SelectItem>
                <SelectItem value="6months">6 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] relative">
            <canvas
              ref={accuracyChartRef}
              className="w-full h-full"
              data-testid="chart-accuracy"
            />
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Performance Chart */}
      <Card className="shadow-sm border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold" data-testid="text-portfolio-chart-title">
                Portfolio Performance
              </CardTitle>
              <CardDescription>
                Your trading performance metrics
              </CardDescription>
            </div>
            <Select value={portfolioPeriod} onValueChange={setPortfolioPeriod}>
              <SelectTrigger className="w-32 bg-white/80 backdrop-blur-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-sm">
                <SelectItem value="1day">1 Day</SelectItem>
                <SelectItem value="7days">7 Days</SelectItem>
                <SelectItem value="14days">14 Days</SelectItem>
                <SelectItem value="21days">21 Days</SelectItem>
                <SelectItem value="28days">28 Days</SelectItem>
                <SelectItem value="2months">2 Months</SelectItem>
                <SelectItem value="4months">4 Months</SelectItem>
                <SelectItem value="5months">5 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] relative">
            <canvas
              ref={portfolioChartRef}
              className="w-full h-full"
              data-testid="chart-portfolio"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}