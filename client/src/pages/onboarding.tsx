import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];

export default function Onboarding() {
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [photoAlbum, setPhotoAlbum] = useState<string[]>([]);
  const [activityPreferences, setActivityPreferences] = useState({
    indoor: false,
    outdoor: false,
    smallGroups: true,
    weekendPreferred: true,
  });

  const [inviteName, setInviteName] = useState('');
  const [inviteContact, setInviteContact] = useState('');
  const [inviteChannel, setInviteChannel] = useState<'sms' | 'email'>('sms');

  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const addInterest = () => {
    const nextInterest = interestInput.trim();
    if (!nextInterest || interests.includes(nextInterest) || interests.length >= 20) {
      return;
    }
    setInterests((prev) => [...prev, nextInterest]);
    setInterestInput('');
  };

  const removeInterest = (value: string) => {
    setInterests((prev) => prev.filter((interest) => interest !== value));
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to read selected file.'));
      };
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    });

  const onSelectProfilePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const imageDataUrl = await fileToDataUrl(file);
      setProfilePhotoUrl(imageDataUrl);
    } catch (error) {
      toast({
        title: 'Image selection failed',
        description: error instanceof Error ? error.message : 'Please try another file.',
        variant: 'destructive',
      });
    } finally {
      event.target.value = '';
    }
  };

  const onSelectAlbumPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    const remainingSlots = 12 - photoAlbum.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Photo limit reached',
        description: 'You can upload up to 12 photos.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    try {
      const newPhotos = await Promise.all(selectedFiles.map((file) => fileToDataUrl(file)));
      setPhotoAlbum((prev) => [...prev, ...newPhotos]);

      if (files.length > remainingSlots) {
        toast({
          title: 'Some photos were skipped',
          description: 'Only the first photos were added due to the 12 photo limit.',
        });
      }
    } catch (error) {
      toast({
        title: 'Photo selection failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      event.target.value = '';
    }
  };

  const removeAlbumPhoto = (index: number) => {
    setPhotoAlbum((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const saveOnboarding = async (markCompleted: boolean) => {
    setIsSaving(true);
    try {
      await apiRequest('PATCH', API_ROUTES.USER_ONBOARDING, {
        bio,
        city,
        age_range: ageRange,
        interests,
        avatar_url: profilePhotoUrl,
        photo_album: photoAlbum,
        activity_preferences: activityPreferences,
        onboarding_completed: markCompleted,
      });

      await queryClient.invalidateQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
      await queryClient.refetchQueries({ queryKey: [API_ROUTES.USER_PROFILE] });

      toast({
        title: markCompleted ? 'Onboarding complete' : 'Saved',
        description: markCompleted
          ? 'Your profile is ready. Let\'s find your first activity.'
          : 'Your onboarding progress was saved.',
      });

      navigate('/');
    } catch (error) {
      toast({
        title: 'Failed to save onboarding',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteContact.trim()) {
      return;
    }

    setIsInviting(true);
    try {
      const response = await apiRequest('POST', API_ROUTES.USER_INVITES, {
        contact_name: inviteName,
        contact_value: inviteContact,
        channel: inviteChannel,
      });
      const invite = await response.json();
      const inviteUrl = `${window.location.origin}/invite/${invite.token}`;

      toast({
        title: 'Invite created',
        description: `Share this link: ${inviteUrl}`,
      });

      setInviteName('');
      setInviteContact('');
    } catch (error) {
      toast({
        title: 'Invite failed',
        description: error instanceof Error ? error.message : 'Unable to create invite.',
        variant: 'destructive',
      });
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Finish your profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bio">About you</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="What do you enjoy doing?"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Seattle"
                />
              </div>
              <div className="space-y-2">
                <Label>Age range</Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select age range" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_RANGES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hobbies & interests</Label>
              <div className="flex gap-2">
                <Input
                  value={interestInput}
                  onChange={(event) => setInterestInput(event.target.value)}
                  placeholder="Hiking, board games, coffee..."
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addInterest();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addInterest}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                    {interest}
                    <button type="button" onClick={() => removeInterest(interest)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="profile-photo">Profile photo</Label>
              <input
                id="profile-photo"
                type="file"
                accept="image/*"
                onChange={onSelectProfilePhoto}
                className="block w-full text-sm"
              />
              {profilePhotoUrl && (
                <img
                  src={profilePhotoUrl}
                  alt="Profile preview"
                  className="w-28 h-28 rounded-md object-cover border"
                />
              )}

              <Label htmlFor="album-photos">Photo album (up to 12)</Label>
              <div className="flex gap-2 items-center">
                <input
                  id="album-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onSelectAlbumPhotos}
                  className="block w-full text-sm"
                />
                <span className="text-sm text-gray-500">{photoAlbum.length}/12</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {photoAlbum.map((photoUrl, index) => (
                  <div key={`${photoUrl}-${index}`} className="relative">
                    <img
                      src={photoUrl}
                      alt={`Album preview ${index + 1}`}
                      className="w-full h-24 rounded-md object-cover border"
                    />
                    <button
                      type="button"
                      onClick={() => removeAlbumPhoto(index)}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Activity preferences</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <PreferenceToggle
                  label="Indoor activities"
                  checked={activityPreferences.indoor}
                  onChange={(checked) =>
                    setActivityPreferences((prev) => ({ ...prev, indoor: checked }))
                  }
                />
                <PreferenceToggle
                  label="Outdoor activities"
                  checked={activityPreferences.outdoor}
                  onChange={(checked) =>
                    setActivityPreferences((prev) => ({ ...prev, outdoor: checked }))
                  }
                />
                <PreferenceToggle
                  label="Prefer small groups"
                  checked={activityPreferences.smallGroups}
                  onChange={(checked) =>
                    setActivityPreferences((prev) => ({ ...prev, smallGroups: checked }))
                  }
                />
                <PreferenceToggle
                  label="Weekend preferred"
                  checked={activityPreferences.weekendPreferred}
                  onChange={(checked) =>
                    setActivityPreferences((prev) => ({ ...prev, weekendPreferred: checked }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite friends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder="Friend name (optional)"
            />
            <Input
              value={inviteContact}
              onChange={(event) => setInviteContact(event.target.value)}
              placeholder="Phone number or email"
            />
            <Select value={inviteChannel} onValueChange={(value) => setInviteChannel(value as 'sms' | 'email')}>
              <SelectTrigger>
                <SelectValue placeholder="Invite channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={sendInvite} disabled={isInviting}>
              {isInviting ? 'Creating invite...' : 'Create invite link'}
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={() => void saveOnboarding(true)} disabled={isSaving}>
            Skip for now
          </Button>
          <Button type="button" onClick={() => void saveOnboarding(true)} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Complete onboarding'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-md border p-3 flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
