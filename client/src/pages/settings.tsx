import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { apiRequest } from '@/lib/queryClient';
import {
  ArrowLeft,
  Bell,
  Eye,
  Trash2,
  Download,
  Shield,
  Globe,
  Moon,
  Sun,
  User,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  activityReminders: boolean;
  newMatches: boolean;
  messages: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  locationSharing: boolean;
  showAge: boolean;
  showEmail: boolean;
}

interface PreferenceSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  distanceUnit: 'miles' | 'kilometers';
  maxDistance: number;
}

interface UserSettings {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  preferences: PreferenceSettings;
}

type UserPreferencesResponse = Partial<PreferenceSettings> & {
  notifications?: NotificationSettings;
  privacy?: PrivacySettings;
};

interface UserProfileResponse {
  preferences?: UserPreferencesResponse;
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
    },
    privacy: {
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

  const loadUserSettings = useCallback(async () => {
    try {
      const response = await apiRequest('GET', '/api/users/profile/');
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const userData = (await response.json()) as UserProfileResponse;
      const preferences = userData.preferences ?? {};
      const { notifications, privacy, ...preferenceOverrides } = preferences;

      setSettings((prev) => ({
        notifications: notifications ?? prev.notifications,
        privacy: privacy ?? prev.privacy,
        preferences: {
          ...prev.preferences,
          ...preferenceOverrides,
        },
      }));

      if (preferenceOverrides.theme) {
        setTheme(preferenceOverrides.theme);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, [setTheme]);

  useEffect(() => {
    // Load user settings from API
    loadUserSettings();
  }, [loadUserSettings]);

  const updateSettings = useCallback(
    async <Section extends keyof UserSettings>(
      section: Section,
      newSettings: UserSettings[Section],
    ) => {
      try {
        setLoading(true);

        const payload: Partial<UserSettings> =
          section === 'preferences'
            ? { preferences: newSettings as PreferenceSettings }
            : ({ [section]: newSettings } as Partial<UserSettings>);

        const response = await apiRequest('PATCH', '/api/users/profile/', payload);

        if (!response.ok) {
          throw new Error('Failed to update settings');
        }

        const updatedUser = (await response.json()) as UserProfileResponse;
        const preferences = updatedUser.preferences ?? {};
        const { notifications, privacy, ...preferenceOverrides } = preferences;

        setSettings((prev) => ({
          notifications:
            notifications ??
            (section === 'notifications'
              ? (newSettings as NotificationSettings)
              : prev.notifications),
          privacy:
            privacy ?? (section === 'privacy' ? (newSettings as PrivacySettings) : prev.privacy),
          preferences: {
            ...prev.preferences,
            ...(section === 'preferences'
              ? (newSettings as PreferenceSettings)
              : preferenceOverrides),
          },
        }));

        toast({
          title: 'Settings updated',
          description: 'Your settings have been saved successfully.',
        });
      } catch (error) {
        console.error('Failed to update settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to update settings. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const handleNotificationChange = (key: keyof NotificationSettings, value: boolean) => {
    const newNotifications: NotificationSettings = { ...settings.notifications, [key]: value };
    updateSettings('notifications', newNotifications);
  };

  const handlePrivacyChange = <Key extends keyof PrivacySettings>(
    key: Key,
    value: PrivacySettings[Key],
  ) => {
    const newPrivacy: PrivacySettings = { ...settings.privacy, [key]: value };
    updateSettings('privacy', newPrivacy);
  };

  const handlePreferenceChange = <Key extends keyof PreferenceSettings>(
    key: Key,
    value: PreferenceSettings[Key],
  ) => {
    const newPreferences: PreferenceSettings = {
      ...settings.preferences,
      [key]: value,
    } as PreferenceSettings;
    updateSettings('preferences', newPreferences);

    if (key === 'theme') {
      setTheme(value as PreferenceSettings['theme']);
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
          title: 'Data exported',
          description: 'Your data has been downloaded successfully.',
        });
      } else {
        throw new Error('Failed to export data');
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to export data. Please try again.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const deleteAccount = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      )
    ) {
      try {
        await apiRequest('DELETE', '/api/users/profile/delete/');

        // Clear all user data from local storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');

        toast({
          title: 'Account deleted',
          description: 'Your account has been permanently deleted.',
        });

        // Redirect to landing page
        window.location.href = '/';
      } catch (error) {
        console.error('Error deleting account:', error);
        const message =
          error instanceof Error ? error.message : 'Failed to delete account. Please try again.';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
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

  const initials =
    `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() ||
    user.email?.charAt(0).toUpperCase() ||
    'U';

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-16">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm p-4">
        <div className="flex items-center">
          {' '}
          <Button variant="ghost" size="sm" onClick={() => onBack && onBack()} className="mr-4">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>
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
                    : user.email?.split('@')[0] || 'User'}
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
                onCheckedChange={(checked) =>
                  handleNotificationChange('pushNotifications', checked)
                }
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <Switch
                id="email-notifications"
                checked={settings.notifications.emailNotifications}
                onCheckedChange={(checked) =>
                  handleNotificationChange('emailNotifications', checked)
                }
                disabled={loading}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="activity-reminders">Activity Reminders</Label>
              <Switch
                id="activity-reminders"
                checked={settings.notifications.activityReminders}
                onCheckedChange={(checked) =>
                  handleNotificationChange('activityReminders', checked)
                }
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
                id="show-location"
                checked={settings.privacy.locationSharing}
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
                onValueChange={(value) =>
                  handlePreferenceChange('theme', value as PreferenceSettings['theme'])
                }
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
                onValueChange={(value) =>
                  handlePreferenceChange(
                    'distanceUnit',
                    value as PreferenceSettings['distanceUnit'],
                  )
                }
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
                onChange={(e) =>
                  handlePreferenceChange('maxDistance', Number.parseInt(e.target.value, 10) || 0)
                }
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
            <Button variant="outline" className="w-full justify-start" onClick={exportData}>
              <Download className="w-4 h-4 mr-2" />
              Export My Data
            </Button>

            <Separator />

            <Button variant="destructive" className="w-full justify-start" onClick={deleteAccount}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
            <p className="text-xs text-gray-500">
              This action cannot be undone. All your activities, swipes, matches, and reviews will
              be permanently deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

