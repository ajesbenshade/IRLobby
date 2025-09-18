import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Bell, 
  Lock, 
  User, 
  MapPin, 
  Eye,
  Trash2,
  Download,
  Shield,
  Globe,
  Moon,
  Sun
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/hooks/useTheme";

interface UserSettings {
  notifications: {
    pushNotifications: boolean;
    emailNotifications: boolean;
    activityReminders: boolean;
    newMatches: boolean;
    messages: boolean;
  };  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    locationSharing: boolean;
    showAge: boolean;
    showEmail: boolean;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    distanceUnit: 'miles' | 'kilometers';
    maxDistance: number;
  };
}

export default function Settings({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      pushNotifications: true,
      emailNotifications: true,
      activityReminders: true,
      newMatches: true,
      messages: true,
    },    privacy: {
      profileVisibility: 'public',
      locationSharing: true,
      showAge: true,
      showEmail: false,
    },
    preferences: {
      theme: 'system',
      language: 'English',
      distanceUnit: 'miles',
      maxDistance: 25,
    },
  });

  useEffect(() => {
    // Load user settings from API
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const response = await apiRequest('GET', '/api/users/profile/');
      
      if (response.ok) {
        const userData = await response.json();
        const loadedPreferences = userData.preferences || {};
        setSettings(prev => ({
          ...prev,
          preferences: loadedPreferences,
          notifications: loadedPreferences.notifications || prev.notifications,
          privacy: loadedPreferences.privacy || prev.privacy,
        }));
        
        // Apply theme from loaded preferences
        if (loadedPreferences.theme) {
          setTheme(loadedPreferences.theme);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };
  const updateSettings = async (section: keyof UserSettings, newSettings: any) => {
    try {
      setLoading(true);
      
      // For preferences, update the entire preferences object
      const payload = section === 'preferences' 
        ? { preferences: newSettings }
        : { [section]: newSettings };
      
      const response = await apiRequest('PATCH', '/api/users/profile/', payload);

      if (response.ok) {
        const updatedUser = await response.json();
        setSettings(prev => ({
          ...prev,
          preferences: updatedUser.preferences || {},
          notifications: updatedUser.preferences?.notifications || prev.notifications,
          privacy: updatedUser.preferences?.privacy || prev.privacy,
        }));
        toast({
          title: "Settings updated",
          description: "Your settings have been saved successfully.",
        });
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key: keyof typeof settings.notifications, value: boolean) => {
    const newNotifications = { ...settings.notifications, [key]: value };
    updateSettings('notifications', newNotifications);
  };

  const handlePrivacyChange = (key: keyof typeof settings.privacy, value: any) => {
    const newPrivacy = { ...settings.privacy, [key]: value };
    updateSettings('privacy', newPrivacy);
  };

  const handlePreferenceChange = (key: keyof typeof settings.preferences, value: any) => {
    const newPreferences = { ...settings.preferences, [key]: value };
    updateSettings('preferences', newPreferences);
    
    // Apply theme change immediately
    if (key === 'theme') {
      setTheme(value);
    }
  };
  const exportData = async () => {
    try {
      const response = await apiRequest('GET', '/api/users/profile/export/');

      if (response.ok) {
        const data = await response.json();
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `irlobby-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Data exported",
          description: "Your data has been downloaded successfully.",
        });
      } else {
        throw new Error('Failed to export data');
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      toast({
        title: "Error",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.')) {
      try {
        const response = await apiRequest('DELETE', '/api/users/profile/delete/');
        
        // Clear all user data from local storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        
        toast({
          title: "Account deleted",
          description: "Your account has been permanently deleted.",
        });
        
        // Redirect to landing page
        window.location.href = '/';
      } catch (error: any) {
        console.error('Error deleting account:', error);
        const errorMessage = error.message || 'Failed to delete account. Please try again.';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center p-4">          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBack && onBack()}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-gray-800">Settings</h1>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="text-lg font-bold bg-primary text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user.email?.split('@')[0] || 'User'
                  }
                </h3>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="push-notifications">Push Notifications</Label>
              <Switch
                id="push-notifications"
                checked={settings.notifications.pushNotifications}
                onCheckedChange={(checked) => handleNotificationChange('pushNotifications', checked)}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <Switch
                id="email-notifications"
                checked={settings.notifications.emailNotifications}
                onCheckedChange={(checked) => handleNotificationChange('emailNotifications', checked)}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="activity-reminders">Activity Reminders</Label>
              <Switch
                id="activity-reminders"
                checked={settings.notifications.activityReminders}
                onCheckedChange={(checked) => handleNotificationChange('activityReminders', checked)}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="new-matches">New Matches</Label>
              <Switch
                id="new-matches"
                checked={settings.notifications.newMatches}
                onCheckedChange={(checked) => handleNotificationChange('newMatches', checked)}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="messages">Messages</Label>
              <Switch
                id="messages"
                checked={settings.notifications.messages}
                onCheckedChange={(checked) => handleNotificationChange('messages', checked)}
                disabled={loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="profile-visibility" className="text-sm font-medium">
                Profile Visibility
              </Label>
              <Select
                value={settings.privacy.profileVisibility}
                onValueChange={(value) => handlePrivacyChange('profileVisibility', value)}
                disabled={loading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="friends">Friends Only</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-location">Show Location</Label>
              <Switch
                id="show-location"                checked={settings.privacy.locationSharing}
                onCheckedChange={(checked) => handlePrivacyChange('locationSharing', checked)}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-age">Show Age</Label>
              <Switch
                id="show-age"
                checked={settings.privacy.showAge}
                onCheckedChange={(checked) => handlePrivacyChange('showAge', checked)}
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-email">Show Email</Label>
              <Switch
                id="show-email"
                checked={settings.privacy.showEmail}
                onCheckedChange={(checked) => handlePrivacyChange('showEmail', checked)}
                disabled={loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="w-5 h-5 mr-2" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="theme" className="text-sm font-medium">
                Theme
              </Label>
              <Select
                value={settings.preferences.theme}
                onValueChange={(value) => handlePreferenceChange('theme', value)}
                disabled={loading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center">
                      <Sun className="w-4 h-4 mr-2" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center">
                      <Moon className="w-4 h-4 mr-2" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="distance-unit" className="text-sm font-medium">
                Distance Unit
              </Label>
              <Select
                value={settings.preferences.distanceUnit}
                onValueChange={(value) => handlePreferenceChange('distanceUnit', value)}
                disabled={loading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="miles">Miles</SelectItem>
                  <SelectItem value="kilometers">Kilometers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="max-distance" className="text-sm font-medium">
                Maximum Distance ({settings.preferences.distanceUnit})
              </Label>
              <Input
                id="max-distance"
                type="number"
                value={settings.preferences.maxDistance}
                onChange={(e) => handlePreferenceChange('maxDistance', parseInt(e.target.value))}
                disabled={loading}
                min="1"
                max="100"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Data & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Data & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={exportData}
            >
              <Download className="w-4 h-4 mr-2" />
              Export My Data
            </Button>
            
            <Separator />
            
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={deleteAccount}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
            <p className="text-xs text-gray-500">
              This action cannot be undone. All your activities, swipes, matches, and reviews will be permanently deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
