import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Mail, Search, User, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const [location] = useLocation();

  // Get current page name based on route
  const getPageName = (path: string) => {
    switch (path) {
      case "/":
        return "Dashboard";
      case "/predictions":
        return "Predictions";
      case "/portfolio":
        return "Portfolio";
      case "/subscription":
        return "Subscription";
      case "/notifications":
        return "Notifications";
      case "/plans":
        return "Plans";
      case "/settings":
        return "Settings";
      case "/activities":
        return "Activities";
      case "/trading-history":
        return "Trading History";
      case "/cryptocurrencies":
        return "Cryptocurrencies";
      case "/crypto-plans":
        return "Crypto Plans";
      case "/crypto-predictions":
        return "Crypto Predictions";
      case "/crypto-trading":
        return "Crypto Trading";
      default:
        return "Dashboard";
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between p-4">
        {/* Logo and Current Page */}
        <div className="flex-1 flex items-center">
          <div className="text-lg font-semibold text-gray-800">
            {getPageName(location)}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="relative" 
            onClick={() => window.location.href = '/notifications'}
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            <Badge 
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs h-5 w-5 flex items-center justify-center p-0 rounded-full"
              data-testid="badge-notification-count"
            >
              3
            </Badge>
          </Button>
          
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full" data-testid="button-user-menu">
                <Avatar>
                  <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.email || "User"} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-white dark:bg-gray-900 border-gray-200" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || "No email"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = '/portfolio'}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = '/subscription'}>
                <span className="mr-2">💎</span>
                <span>Subscription</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={async () => {
                  await fetch('/api/logout', { method: 'POST' });
                  window.location.href = '/';
                }}
                className="text-red-600"
                data-testid="button-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
