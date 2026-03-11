import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, TrendingUp, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function ActivityFeed() {
  const [, setLocation] = useLocation();

  const handleViewAll = () => {
    setLocation('/activities');
  };

  const handleActivityClick = (activityId: number) => {
    setLocation(`/activities/${activityId}`);
  };

  const activities = [
    {
      id: 1,
      type: 'success',
      title: 'Prediction for SUZLON completed',
      description: 'Target price ₹54.20 achieved. Accuracy: 89.2%',
      time: '2 hours ago',
      icon: CheckCircle,
      iconColor: 'bg-green-500'
    },
    {
      id: 2,
      type: 'alert',
      title: 'Price alert triggered for TCS',
      description: 'Stock reached target price of ₹3,900',
      time: '5 hours ago',
      icon: AlertCircle,
      iconColor: 'bg-yellow-500'
    },
    {
      id: 3,
      type: 'prediction',
      title: 'New prediction generated for RELIANCE',
      description: 'Bullish trend detected. Confidence: 91.5%',
      time: '1 day ago',
      icon: TrendingUp,
      iconColor: 'bg-blue-500'
    },
    {
      id: 4,
      type: 'reminder',
      title: 'Subscription renewal reminder',
      description: 'Your premium plan expires in 15 days',
      time: '2 days ago',
      icon: Clock,
      iconColor: 'bg-purple-500'
    }
  ];

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold" data-testid="text-activity-title">
            Recent Activity
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleViewAll}
            data-testid="button-view-all-activities"
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const IconComponent = activity.icon;
            
            return (
              <div 
                key={activity.id} 
                className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => handleActivityClick(activity.id)}
                data-testid={`activity-item-${activity.id}`}
              >
                <div className={`w-10 h-10 ${activity.iconColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900" data-testid={`activity-title-${activity.id}`}>
                    {activity.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1" data-testid={`activity-description-${activity.id}`}>
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-2" data-testid={`activity-time-${activity.id}`}>
                    {activity.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
