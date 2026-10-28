import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import {
  feedbackMailto,
  settingsFromProfilePreferences,
  SUPPORT_EMAIL,
  toSettingsPayload,
  type NotificationSettings,
  type UserSettings,
} from '@/lib/settingsPreferences';
import { API_ROUTES } from '@shared/schema';
import { ArrowLeft, Bell, Download, Mail, Shield, Trash2, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type VisibleNotificationKey =
  | 'pushNotifications'
  | 'emailNotifications'
  | 'activityReminders'
  | 'messages';

const NOTIFICATION_ROWS: { key: VisibleNotificationKey; id: string; label: string }[] = [
  { key: 'pushNotifications', id: 'push-notifications', label: 'Push notifications' },
  { key: 'emailNotifications', id: 'email-notifications', label: 'Email notifications' },
  { key: 'activityReminders', id: 'activity-reminders', label: 'Activity reminders' },
  { key: 'messages', id: 'messages', label: 'Messages' },
];

const emptySettings = (): UserSettings => settingsFromProfilePreferences(undefined);

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(emptySettings);

  const loadUserSettings = useCallback(async () => {
    try {
      setLoadError(false);
      const response = await apiRequest('GET', API_ROUTES.USER_PROFILE);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const userData = (await response.json()) as { preferences?: unknown };
      setSettings(settingsFromProfilePreferences(userData.preferences));
      setReady(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setReady(false);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void loadUserSettings();
  }, [loadUserSettings]);

  const updateNotifications = useCallback(
    async (notifications: NotificationSettings) => {
      const next: UserSettings = { ...settings, notifications };
      try {
        setLoading(true);

        const response = await apiRequest(
          'PATCH',
          API_ROUTES.USER_PROFILE,
          toSettingsPayload(next),
        );

        if (!response.ok) {
          throw new Error('Failed to update settings');
        }

        const updatedUser = (await response.json()) as { preferences?: unknown };
        const savedPreferences = updatedUser.preferences;
        setSettings(
          savedPreferences && typeof savedPreferences === 'object'
            ? settingsFromProfilePreferences(savedPreferences)
            : next,
        );

        toast({
          title: 'Settings updated',
          description: 'Your settings have been saved successfully.',
        });
      } catch (error) {
        console.error('Failed to update settings:', error);
        toast({
          title: 'Error',
          description: "Something didn't save. Try again.",
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [settings, toast],
  );

  const handleNotificationChange = (key: VisibleNotificationKey, value: boolean) => {
    void updateNotifications({ ...settings.notifications, [key]: value });
  };

  const exportData = async () => {
    try {
      const response = await apiRequest('GET', API_ROUTES.USER_PROFILE_EXPORT);

      if (response.ok) {
        const data = await response.json();
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `foyer-data-export-${new Date().toISOString().split('T')[0]}.json`;
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
        await apiRequest('DELETE', API_ROUTES.USER_PROFILE_DELETE);

        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');

        toast({
          title: 'Account deleted',
          description: 'Your account has been permanently deleted.',
        });

        navigate('/', { replace: true });
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
  const switchesDisabled = loading || !ready;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-[calc(var(--bottom-nav-offset)+1rem)]">
      <header className="bg-white dark:bg-gray-800 shadow-sm p-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app/profile')}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Notifications, feedback, and account actions.
            </p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
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

        {loadError ? (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Couldn&apos;t load settings. Try again.
              </p>
              <Button variant="outline" onClick={() => void loadUserSettings()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {NOTIFICATION_ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between">
                <Label htmlFor={row.id}>{row.label}</Label>
                <Switch
                  id={row.id}
                  checked={Boolean(settings.notifications[row.key])}
                  onCheckedChange={(checked) => handleNotificationChange(row.key, checked)}
                  disabled={switchesDisabled}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Help
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href={feedbackMailto()} data-testid="settings-send-feedback">
                <Mail className="w-4 h-4 mr-2" />
                Send feedback
              </a>
            </Button>
            <p className="text-xs text-gray-500">Email the team at {SUPPORT_EMAIL}</p>
          </CardContent>
        </Card>

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
              Export my data
            </Button>

            <Separator />

            <Button variant="destructive" className="w-full justify-start" onClick={deleteAccount}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete account
            </Button>
            <p className="text-xs text-gray-500">
              This action cannot be undone. Your gatherings, RSVPs, and account data will be
              permanently deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
