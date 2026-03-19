import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Check, Trash2, Settings, TrendingUp, AlertTriangle, Info, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: "prediction" | "alert" | "market" | "system";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

interface AlertConfig {
  predictionAlerts: boolean;
  predictionStocks: string[];
  priceAlerts: boolean;
  priceTargets: { symbol: string; targetPrice: string }[];
  marketUpdates: boolean;
}

const STORAGE_KEY = "bullwiser_notifications";
const SETTINGS_KEY = "bullwiser_alert_settings";

function loadNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveNotifications(notifs: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
}

function loadSettings(): AlertConfig {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {
      predictionAlerts: true,
      predictionStocks: [],
      priceAlerts: false,
      priceTargets: [],
      marketUpdates: true,
    };
  } catch {
    return { predictionAlerts: true, predictionStocks: [], priceAlerts: false, priceTargets: [], marketUpdates: true };
  }
}

export default function Notifications() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);
  const [settings, setSettings] = useState<AlertConfig>(loadSettings);
  const [newPredStock, setNewPredStock] = useState("");
  const [newPriceSymbol, setNewPriceSymbol] = useState("");
  const [newPriceTarget, setNewPriceTarget] = useState("");

  // Fetch real user data to generate real notifications
  const { data: predictions } = useQuery({
    queryKey: ["/api/user/predictions"],
    enabled: isAuthenticated,
  });

  const { data: marketData } = useQuery({
    queryKey: ["/api/market/overview"],
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["/api/user/subscriptions"],
    enabled: isAuthenticated,
  });

  // Generate real notifications from actual data
  useEffect(() => {
    if (!predictions && !marketData && !subscriptions) return;

    const existing = loadNotifications();
    const existingIds = new Set(existing.map(n => n.id));
    const newNotifs: Notification[] = [...existing];

    // Notifications from predictions
    if (predictions && Array.isArray(predictions)) {
      predictions.slice(0, 5).forEach((p: any) => {
        const id = `pred-${p.id}`;
        if (!existingIds.has(id)) {
          const isCrypto = p.stock?.startsWith('CRYPTO_');
          const symbol = isCrypto ? p.stock.replace('CRYPTO_', '') : p.stock;
          newNotifs.unshift({
            id,
            type: "prediction",
            title: `${isCrypto ? 'Crypto' : 'Stock'} Prediction: ${symbol}`,
            message: `Prediction generated — Target: ₹${p.predLow?.toFixed(2)}–₹${p.predHigh?.toFixed(2)} | Confidence: ${p.confidence?.toFixed(1)}%`,
            timestamp: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
            read: false,
            actionUrl: "/predictions",
          });
        }
      });
    }

    // Notification from subscription activation
    if (subscriptions && Array.isArray(subscriptions)) {
      subscriptions.slice(0, 2).forEach((s: any) => {
        const id = `sub-${s.id}`;
        if (!existingIds.has(id)) {
          newNotifs.push({
            id,
            type: "system",
            title: "Subscription Activated",
            message: `Your ${s.mode} plan is active — ${s.tradesPerDay} trades/day for ₹${s.price}`,
            timestamp: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
            read: false,
          });
        }
      });
    }

    // Market update notification from real data
    if (marketData?.indices?.nifty50 && settings.marketUpdates) {
      const nifty = marketData.indices.nifty50;
      const id = `market-${new Date().toDateString()}`;
      if (!existingIds.has(id) && nifty.value > 0) {
        const trend = nifty.changePercent > 0 ? "bullish 📈" : "bearish 📉";
        newNotifs.unshift({
          id,
          type: "market",
          title: "Market Update",
          message: `NIFTY 50 at ₹${nifty.value.toLocaleString('en-IN')} (${nifty.changePercent > 0 ? '+' : ''}${nifty.changePercent?.toFixed(2)}%) — Market is ${trend} today`,
          timestamp: Date.now(),
          read: false,
        });
      }
    }

    // Price alert notifications
    if (settings.priceAlerts && settings.priceTargets.length > 0) {
      settings.priceTargets.forEach(async (target) => {
        try {
          const res = await fetch(`/api/stock/${target.symbol}`);
          if (res.ok) {
            const data = await res.json();
            const current = data.lastPrice;
            const targetPrice = parseFloat(target.targetPrice);
            const id = `price-${target.symbol}-${Math.floor(Date.now() / 3600000)}`;
            if (!existingIds.has(id) && current >= targetPrice) {
              setNotifications(prev => {
                const updated = [{
                  id,
                  type: "alert" as const,
                  title: `Price Alert: ${target.symbol}`,
                  message: `${target.symbol} has reached ₹${current.toFixed(2)} — your target was ₹${targetPrice}`,
                  timestamp: Date.now(),
                  read: false,
                  actionUrl: "/predictions",
                }, ...prev];
                saveNotifications(updated);
                return updated;
              });
            }
          }
        } catch {}
      });
    }

    // Sort by newest first and save
    newNotifs.sort((a, b) => b.timestamp - a.timestamp);
    saveNotifications(newNotifs.slice(0, 50)); // Keep max 50
    setNotifications(newNotifs.slice(0, 50));
  }, [predictions, marketData, subscriptions]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(updated);
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
    toast({ title: "All notifications marked as read" });
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveNotifications(updated);
      return updated;
    });
  };

  const addPredictionStock = () => {
    if (!newPredStock.trim()) return;
    const symbol = newPredStock.trim().toUpperCase();
    if (!settings.predictionStocks.includes(symbol)) {
      setSettings(prev => ({ ...prev, predictionStocks: [...prev.predictionStocks, symbol] }));
    }
    setNewPredStock("");
  };

  const removePredictionStock = (symbol: string) => {
    setSettings(prev => ({ ...prev, predictionStocks: prev.predictionStocks.filter(s => s !== symbol) }));
  };

  const addPriceTarget = () => {
    if (!newPriceSymbol.trim() || !newPriceTarget.trim()) return;
    const symbol = newPriceSymbol.trim().toUpperCase();
    setSettings(prev => ({
      ...prev,
      priceTargets: [...prev.priceTargets.filter(t => t.symbol !== symbol), { symbol, targetPrice: newPriceTarget }],
    }));
    setNewPriceSymbol("");
    setNewPriceTarget("");
    toast({ title: `Price alert set for ${symbol} at ₹${newPriceTarget}` });
  };

  const removePriceTarget = (symbol: string) => {
    setSettings(prev => ({ ...prev, priceTargets: prev.priceTargets.filter(t => t.symbol !== symbol) }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "prediction": return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case "alert": return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "market": return <TrendingUp className="h-5 w-5 text-green-500" />;
      default: return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Stay updated with your predictions and market alerts</p>
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white">{unreadCount} unread</Badge>
          )}
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
            <Check className="h-4 w-4 mr-2" />Mark all read
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2" />Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3">
              <BellOff className="h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-center text-gray-400">Make predictions or subscribe to receive alerts</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-1">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="flex items-start justify-between space-x-4">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="mt-1">{getIcon(n.type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className={`text-sm font-medium ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</h4>
                            {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                          <div className="flex items-center space-x-4 mt-2">
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                            </span>
                            {n.actionUrl && (
                              <Button variant="link" size="sm" className="text-xs p-0 h-auto"
                                onClick={() => window.location.href = n.actionUrl!}>
                                View Details
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {!n.read && (
                          <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                          onClick={() => deleteNotification(n.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Prediction Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Prediction Alerts</h4>
                <p className="text-xs text-gray-500">Get notified when predictions are generated for specific stocks</p>
              </div>
              <Switch
                checked={settings.predictionAlerts}
                onCheckedChange={(v) => setSettings(prev => ({ ...prev, predictionAlerts: v }))}
              />
            </div>
            {settings.predictionAlerts && (
              <div className="ml-4 space-y-2">
                <Label className="text-xs text-gray-600">Watch these stocks/cryptos:</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. TCS, RELIANCE, BTC"
                    value={newPredStock}
                    onChange={e => setNewPredStock(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPredictionStock()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={addPredictionStock}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.predictionStocks.map(s => (
                    <Badge key={s} variant="outline" className="flex items-center gap-1">
                      {s}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removePredictionStock(s)} />
                    </Badge>
                  ))}
                  {settings.predictionStocks.length === 0 && (
                    <span className="text-xs text-gray-400">No stocks added — alerts for all predictions</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Price Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Price Alerts</h4>
                <p className="text-xs text-gray-500">Get notified when a stock/crypto hits your target price</p>
              </div>
              <Switch
                checked={settings.priceAlerts}
                onCheckedChange={(v) => setSettings(prev => ({ ...prev, priceAlerts: v }))}
              />
            </div>
            {settings.priceAlerts && (
              <div className="ml-4 space-y-2">
                <Label className="text-xs text-gray-600">Set price targets:</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Symbol (e.g. TCS)"
                    value={newPriceSymbol}
                    onChange={e => setNewPriceSymbol(e.target.value)}
                    className="h-8 text-sm w-32"
                  />
                  <Input
                    placeholder="Target ₹ price"
                    value={newPriceTarget}
                    onChange={e => setNewPriceTarget(e.target.value)}
                    type="number"
                    className="h-8 text-sm w-36"
                  />
                  <Button size="sm" onClick={addPriceTarget}>Set Alert</Button>
                </div>
                <div className="space-y-1">
                  {settings.priceTargets.map(t => (
                    <div key={t.symbol} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5">
                      <span className="text-sm font-medium">{t.symbol}</span>
                      <span className="text-sm text-gray-600">Target: ₹{t.targetPrice}</span>
                      <X className="h-4 w-4 cursor-pointer text-red-400" onClick={() => removePriceTarget(t.symbol)} />
                    </div>
                  ))}
                  {settings.priceTargets.length === 0 && (
                    <span className="text-xs text-gray-400">No price alerts set</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Market Updates */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Market Updates</h4>
              <p className="text-xs text-gray-500">Daily NIFTY/SENSEX market movement notifications</p>
            </div>
            <Switch
              checked={settings.marketUpdates}
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, marketUpdates: v }))}
            />
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
