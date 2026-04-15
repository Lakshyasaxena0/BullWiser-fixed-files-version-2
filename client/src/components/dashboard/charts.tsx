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
  const accuracyChartInstance = useRef<any>(null);
  const [predictionPeriod, setPredictionPeriod] = useState("1month");
  const { isAuthenticated } = useAuth();

  // ✅ FETCH REAL PREDICTION HISTORY
  const { data: predictionHistory } = useQuery({
    queryKey: ["/api/user/predictions"],
    enabled: isAuthenticated,
    select: (data: any[]) => {
      // Calculate accuracy stats from real predictions
      const measured = data.filter((p: any) => p.actualPrice !== null);
      
      if (measured.length === 0) return null;
      
      // Group by week
      const weeklyData = new Map<string, { correct: number; total: number }>();
      
      measured.forEach((pred: any) => {
        const date = new Date(pred.createdAt);
        const weekNum = Math.floor((Date.now() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const weekKey = `Week ${Math.max(1, 4 - weekNum)}`;
        
        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, { correct: 0, total: 0 });
        }
        
        const stats = weeklyData.get(weekKey)!;
        stats.total++;
        
        // Check if prediction was accurate
        const withinRange = pred.actualPrice >= pred.predLow && pred.actualPrice <= pred.predHigh;
        if (withinRange) stats.correct++;
      });
      
      // Convert to chart data
      return Array.from(weeklyData.entries())
        .map(([week, stats]) => ({
          week,
          accuracy: Math.round((stats.correct / stats.total) * 100)
        }))
        .slice(0, 4);
    }
  });

  const hasPredictions = predictionHistory && predictionHistory.length > 0;

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => initializeCharts();
    document.head.appendChild(script);
    return () => {
      accuracyChartInstance.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (window.Chart) initializeCharts();
  }, [predictionHistory, predictionPeriod, hasPredictions]);

  const initializeCharts = () => {
    if (!window.Chart) return;
    accuracyChartInstance.current?.destroy();

    // ✅ ONLY DRAW ACCURACY CHART IF USER HAS PREDICTIONS WITH ACTUAL PRICES
    if (accuracyChartRef.current && hasPredictions) {
      const labels = predictionHistory.map((d: any) => d.week);
      const data = predictionHistory.map((d: any) => d.accuracy);
      const ctx = accuracyChartRef.current.getContext('2d');
      if (ctx) {
        accuracyChartInstance.current = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{ 
              label: 'Prediction Accuracy', 
              data, 
              borderColor: '#3B82F6', 
              backgroundColor: 'rgba(59,130,246,0.1)', 
              tension: 0.4, 
              fill: true 
            }]
          },
          options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, max: 100, ticks: { callback: (v: any) => v + '%' } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    }
  };

  return (
    <div className="w-full">
      {/* ✅ REMOVED: Market Performance Chart */}
      {/* ✅ KEPT: Prediction Accuracy Chart with REAL DATA */}
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
    </div>
  );
}
