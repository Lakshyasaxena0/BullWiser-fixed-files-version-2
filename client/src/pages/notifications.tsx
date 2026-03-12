
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Check, Trash2, Settings, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: "prediction" | "alert" | "system" | "market";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export default function Notifications() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Notification settings state
  const [predictionAlertsEnabled, setPredictionAlertsEnabled] = useState(true);
  const [priceAlertsEnabled, setPriceAlertsEnabled] = useState(false);
  const [marketUpdatesEnabled, setMarketUpdatesEnabled] = useState(true);
  
  // Mock notifications data - in real app this would come from API
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "prediction",
      title: "Prediction Alert: RELIANCE",
      message: "Your prediction for RELIANCE has reached 85% confidence. Consider reviewing your position.",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      read: false,
      actionUrl: "/predictions"
    },
    {
      id: "2",
      type: "market",
      title: "Market Update",
      message: "NIFTY 50 is showing strong bullish momentum. Multiple stocks in your watchlist are trending up.",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      read: false
    },
    {
      id: "3",
      type: "system",
      title: "Welcome to BullWiser Premium!",
      message: "Your premium subscription is now active. Enjoy unlimited predictions and advanced features.",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      read: true
    },
    {
      id: "4",
      type: "alert",
      title: "Price Alert: TCS",
      message: "TCS has crossed your target price of ₹3,500. Current price: ₹3,525.",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      read: true,
      actionUrl: "/portfolio"
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
    toast({
      title: "All notifications marked as read",
    });
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
    toast({
      title: "Notification deleted",
    });
  };

  const handlePredictionAlertsToggle = (enabled: boolean) => {
    setPredictionAlertsEnabled(enabled);
    toast({
      title: enabled ? "Prediction Alerts Enabled" : "Prediction Alerts Disabled",
      description: enabled ? "You'll receive alerts when predictions reach high confidence" : "Prediction alerts have been turned off",
    });
  };

  const handlePriceAlertsToggle = (enabled: boolean) => {
    setPriceAlertsEnabled(enabled);
    toast({
      title: enabled ? "Price Alerts Enabled" : "Price Alerts Disabled", 
      description: enabled ? "You'll receive alerts when stocks hit your target prices" : "Price alerts have been turned off",
    });
  };

  const handleMarketUpdatesToggle = (enabled: boolean) => {
    setMarketUpdatesEnabled(enabled);
    toast({
      title: enabled ? "Market Updates Enabled" : "Market Updates Disabled",
      description: enabled ? "You'll receive updates about major market movements" : "Market updates have been turned off",
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "prediction":
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case "alert":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "market":
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "system":
        return <Info className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">
            Notifications
          </h1>
          <p className="text-gray-600" data-testid="text-page-description">
            Stay updated with your predictions and market alerts
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white" data-testid="badge-unread-count">
              {unreadCount} unread
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            data-testid="button-mark-all-read"
          >
            <Check className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {notifications.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center" data-testid="text-notifications-title">
                <Bell className="h-5 w-5 mr-2" />
                Recent Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start justify-between space-x-4">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center space-x-4 mt-2">
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(notification.timestamp)}
                              </span>
                              {notification.actionUrl && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-xs p-0 h-auto"
                                  onClick={() => window.location.href = notification.actionUrl!}
                                >
                                  View Details
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                              data-testid={`button-mark-read-${notification.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                            className="text-red-500 hover:text-red-700"
                            data-testid={`button-delete-${notification.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <BellOff className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900" data-testid="text-no-notifications-title">
                No Notifications
              </h3>
              <p className="text-gray-600" data-testid="text-no-notifications-description">
                You're all caught up! We'll notify you when there are updates.
              </p>
            </div>
          </Card>
        )}

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center" data-testid="text-settings-title">
              <Settings className="h-5 w-5 mr-2" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Prediction Alerts</h4>
                <p className="text-xs text-gray-600">Get notified when your predictions reach high confidence</p>
              </div>
              <Switch
                checked={predictionAlertsEnabled}
                onCheckedChange={handlePredictionAlertsToggle}
                data-testid="switch-prediction-alerts"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Price Alerts</h4>
                <p className="text-xs text-gray-600">Receive alerts when stocks hit your target prices</p>
              </div>
              <Switch
                checked={priceAlertsEnabled}
                onCheckedChange={handlePriceAlertsToggle}
                data-testid="switch-price-alerts"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Market Updates</h4>
                <p className="text-xs text-gray-600">Stay informed about major market movements</p>
              </div>
              <Switch
                checked={marketUpdatesEnabled}
                onCheckedChange={handleMarketUpdatesToggle}
                data-testid="switch-market-updates"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
