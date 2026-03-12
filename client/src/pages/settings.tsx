import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User, Settings, Bell, Shield, Trash2, Upload, Save, Camera } from "lucide-react";

interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImageUrl?: string;
}

interface NotificationSettings {
  predictionAlerts: boolean;
  priceAlerts: boolean;
  marketUpdates: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export default function SettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    profileImageUrl: user?.profileImageUrl || "",
  });

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    predictionAlerts: true,
    priceAlerts: false,
    marketUpdates: true,
    emailNotifications: true,
    pushNotifications: false,
  });

  // Privacy settings state
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: "private",
    shareAnalytics: true,
    marketingEmails: false,
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        profileImageUrl: user.profileImageUrl || "",
      });
    }
  }, [user]);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      const res = await apiRequest("PUT", "/api/user/profile", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return await res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      setIsEditing(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Account deletion mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/account");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete account");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/auth";
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handleInputChange = (field: keyof ProfileUpdateData, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationToggle = (setting: keyof NotificationSettings, enabled: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [setting]: enabled }));
    toast({
      title: `${setting} ${enabled ? "enabled" : "disabled"}`,
      description: `Notification preference has been updated.`,
    });
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to access settings.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account preferences and privacy settings</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and profile picture
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex items-center space-x-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileForm.profileImageUrl} alt="Profile" />
                  <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="profile-image">Profile Picture</Label>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Camera className="h-4 w-4 mr-2" />
                      Change Photo
                    </Button>
                    {profileForm.profileImageUrl && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleInputChange("profileImageUrl", "")}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Profile Form */}
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileForm.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileForm.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter your email address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={user?.username || ""}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500">Username cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Premium Plan
                    </Badge>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  {isEditing ? (
                    <>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsEditing(false)}
                        disabled={updateProfileMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={updateProfileMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" onClick={() => setIsEditing(true)}>
                      Edit Profile
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about predictions and market updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Prediction Alerts</Label>
                    <p className="text-sm text-gray-500">Get notified when predictions reach high confidence</p>
                  </div>
                  <Switch
                    checked={notificationSettings.predictionAlerts}
                    onCheckedChange={(checked) => handleNotificationToggle("predictionAlerts", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Price Alerts</Label>
                    <p className="text-sm text-gray-500">Receive alerts when stocks hit target prices</p>
                  </div>
                  <Switch
                    checked={notificationSettings.priceAlerts}
                    onCheckedChange={(checked) => handleNotificationToggle("priceAlerts", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Market Updates</Label>
                    <p className="text-sm text-gray-500">Stay informed about major market movements</p>
                  </div>
                  <Switch
                    checked={notificationSettings.marketUpdates}
                    onCheckedChange={(checked) => handleNotificationToggle("marketUpdates", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-gray-500">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => handleNotificationToggle("emailNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-gray-500">Receive browser push notifications</p>
                  </div>
                  <Switch
                    checked={notificationSettings.pushNotifications}
                    onCheckedChange={(checked) => handleNotificationToggle("pushNotifications", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Security</CardTitle>
              <CardDescription>
                Control your privacy settings and data preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Profile Visibility</Label>
                    <p className="text-sm text-gray-500">Control who can see your profile information</p>
                  </div>
                  <Badge variant="outline">Private</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Share Analytics</Label>
                    <p className="text-sm text-gray-500">Help improve BullWiser by sharing anonymous usage data</p>
                  </div>
                  <Switch
                    checked={privacySettings.shareAnalytics}
                    onCheckedChange={(checked) => 
                      setPrivacySettings(prev => ({ ...prev, shareAnalytics: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Marketing Emails</Label>
                    <p className="text-sm text-gray-500">Receive promotional emails and feature updates</p>
                  </div>
                  <Switch
                    checked={privacySettings.marketingEmails}
                    onCheckedChange={(checked) => 
                      setPrivacySettings(prev => ({ ...prev, marketingEmails: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-medium">Security</Label>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      Change Password
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Two-Factor Authentication
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Download My Data
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  View your account details and membership information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Account Created</Label>
                    <p className="text-sm">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">User ID</Label>
                    <p className="text-sm font-mono text-gray-600">{user?.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Subscription Status</Label>
                    <Badge className="bg-green-100 text-green-800">Premium Plan</Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Data Usage</Label>
                    <p className="text-sm">2.4 GB of 10 GB used</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription>
                  These actions are permanent and cannot be undone
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account,
                        remove all your data, predictions, and watchlists from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAccountMutation.mutate()}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={deleteAccountMutation.isPending}
                      >
                        {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}