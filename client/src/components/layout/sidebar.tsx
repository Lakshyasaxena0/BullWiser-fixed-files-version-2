import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Briefcase, 
  CreditCard, 
  Settings,
  LogOut,
  Bell,
  Crown,
  X,
  Menu,
  ChevronLeft,
  ChevronRight,
  History, // Added for Trading History
  Bitcoin // Added for Crypto Predictions
} from "lucide-react";
import { useState, useEffect } from "react";
import { BullWiserLogo } from "@/components/BullWiserLogo";

// Assuming SidebarMenuButton is a component used for navigation items,
// though not provided in the original code. If it's a custom component,
// it would need to be imported. For now, we'll assume it's either globally available
// or will be handled by the Link component directly if SidebarMenuButton is not used.
// If SidebarMenuButton is a custom component, it would look something like this (example):
// import SidebarMenuButton from "@/components/SidebarMenuButton"; 

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Subscription", href: "/subscription", icon: CreditCard },
  { name: "Predictions", href: "/predictions", icon: TrendingUp },
  { name: "Trading History", href: "/trading-history", icon: History },
  { name: "Cryptocurrencies", href: "/cryptocurrencies", icon: Bitcoin },
  { name: "Plans", href: "/plans", icon: Crown },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const userInitials = user?.firstName && user?.lastName 
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "U";

  // Update main content margin based on sidebar state
  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      if (window.innerWidth >= 1024) { // lg breakpoint
        mainContent.style.marginLeft = isCollapsed ? '4rem' : '16rem'; // 64px : 256px
      }
    }
  }, [isCollapsed]);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsMobileOpen(true)}
        data-testid="button-mobile-menu"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 bg-white shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:transform-none ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="relative p-6 border-b border-gray-200">
            {/* Close button for mobile - positioned absolute */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden absolute top-2 right-2 z-10"
              onClick={() => setIsMobileOpen(false)}
              data-testid="button-close-mobile-menu"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Collapse/Expand button for desktop - positioned absolute */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden lg:flex absolute top-2 right-2 z-10"
              onClick={() => setIsCollapsed(!isCollapsed)}
              data-testid="button-toggle-sidebar"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>

            {/* Logo and branding - horizontal layout */}
            {!isCollapsed ? (
              <div className="flex items-center justify-start space-x-3 px-2">
                <BullWiserLogo className="w-12 h-12 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-xl text-gray-900 tracking-tight">BullWiser</span>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Powered by Faraksh</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <BullWiserLogo className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="p-6 border-b border-gray-200">
            {!isCollapsed ? (
              <div className="flex items-center space-x-3">
                {user?.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover"
                    data-testid="img-user-profile"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg" data-testid="text-user-initials">
                      {userInitials}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900" data-testid="text-user-name">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email || "User"
                    }
                  </p>
                  {/* Increased opacity for better readability */}
                  <p className="text-sm text-gray-500 opacity-80" data-testid="text-user-plan">Premium Plan</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                {user?.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover"
                    data-testid="img-user-profile-collapsed"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm" data-testid="text-user-initials-collapsed">
                      {userInitials}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 overflow-hidden">
            <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <ul className="space-y-2">
                {navigation.map((item) => {
                  const isActive = location === item.href;
                  const Icon = item.icon;

                  return (
                    <li key={item.name}>
                      <Link href={item.href}>
                        <a
                          className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                            isActive
                              ? 'bg-primary text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          } ${
                            isCollapsed ? 'justify-center' : 'space-x-3'
                          }`}
                          onClick={() => {
                            setIsMobileOpen(false);
                          }}
                          data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                          title={isCollapsed ? item.name : undefined}
                        >
                          <Icon className="h-5 w-5" />
                          {!isCollapsed && <span>{item.name}</span>}
                        </a>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200">
            <Button
              variant="ghost"
              className={`flex items-center p-3 w-full rounded-lg text-gray-700 hover:bg-gray-100 ${
                isCollapsed ? 'justify-center' : 'space-x-3 justify-start'
              }`}
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-logout"
              title={isCollapsed ? "Sign Out" : undefined}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span>Sign Out</span>}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}