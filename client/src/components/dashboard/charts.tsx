import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp } from "lucide-react";

declare global {
  interface Window { Chart: any; }
}

export default function Charts() {
  const accuracyChartRef = useRef<HTMLCanvasElement>(null);
  const portfolioChartRef = useRef<HTMLCanvasElement>(null);
  const accuracyChartInstance = useRef<any>(null);
  const portfolioChartInstance = useRef<any>(null);
  const [predictionPeriod, setPredictionPeriod] = useState("30days");
  const [portfolioPeriod, setPortfolioPeriod] = useState("7days");
  const { isAuthenticated } = useAuth();

  const { data: predictionStats } = useQuery({
    queryKey: ["/api/user/predictions/stats"],
    enabled: isAuthenticated,
    refetchInterval: 300000,
  });

  const { data: activePredictions } = useQuery({
    queryKey: ["/api/user/predictions/active"],
    enabled: isAuthenticated,
  });

  const { data: historicalData } = useQuery({
    queryKey: ["/api/stock/NIFTY50/history"],
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const hasPredictions = activePredictions && activePredictions.length > 0;

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => initializeCharts();
    document.head.appendChild(script);
    return () => {
      accuracyChartInstance.current?.destroy();
      portfolioChartInstance.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (window.Chart) initializeCharts();
  }, [predictionStats, historicalData, predictionPeriod, portfolioPeriod, hasPredictions]);

  const initializeCharts = () => {
    if (!window.Chart) return;
    accuracyChartInstance.current?.destroy();
    portfolioChartInstance.current?.destroy();

    // Only draw accuracy chart if user has predictions
    if (accuracyChartRef.current && hasPredictions) {
      const labels = predictionStats?.weeklyAccuracy?.map((i: any) => i.week) || ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const data = predictionStats?.weeklyAccuracy?.map((i: any) => i.accuracy) || [82, 85, 87, 89];
      const ctx = accuracyChartRef.current.getContext('2d');
      if (ctx) {
        accuracyChartInstance.current = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{ label: 'Prediction Accuracy', data, borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, max: 100, ticks: { callback: (v: any) => v + '%' } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    }

    // Portfolio chart from real historical data
    if (portfolioChartRef.current) {
      const days = portfolioPeriod === "7days" ? 7 : 14;
      const slice = historicalData?.slice(-days) || [];
      const labels = slice.length > 0
        ? slice.map((item: any) => {
            const d = new Date(item.date || item.CH_TIMESTAMP);
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          })
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = slice.length > 0
        ? slice.map((item: any) => item.close || item.CH_CLOSING_PRICE || 0)
        : [];
      const ctx = portfolioChartRef.current.getContext('2d');
      if (ctx) {
        portfolioChartInstance.current = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{ label: 'NIFTY 50', data, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { ticks: { callback: (v: any) => '₹' + (v / 1000).toFixed(0) + 'K' } },
              x: { grid: { display: false } }
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
              <CardTitle className="text-lg font-semibold">Prediction Accuracy</CardTitle>
              <CardDescription>Model performance over time</CardDescription>
            </div>
            <Select value={predictionPeriod} onValueChange={setPredictionPeriod}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1week">1 Week</SelectItem>
                <SelectItem value="1month">1 Month</SelectItem>
                <SelectItem value="3months">3 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!hasPredictions ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 space-y-3">
              <TrendingUp className="h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium">No predictions yet</p>
              <p className="text-xs text-gray-400">Make your first prediction to see accuracy charts</p>
            </div>
          ) : (
            <div className="h-[300px] relative">
              <canvas ref={accuracyChartRef} className="w-full h-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portfolio / Market Chart */}
      <Card className="shadow-sm border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Market Performance</CardTitle>
              <CardDescription>NIFTY 50 live chart</CardDescription>
            </div>
            <Select value={portfolioPeriod} onValueChange={setPortfolioPeriod}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">7 Days</SelectItem>
                <SelectItem value="14days">14 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] relative">
            <canvas ref={portfolioChartRef} className="w-full h-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
