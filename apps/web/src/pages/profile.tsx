import FriendsModal from '@/components/FriendsModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { churchSubscribeUrl, copyChurchCalendarLink, openCalendarUrl } from '@/lib/calendar';
import {
  FRANCONIA_CHURCH_NAME,
  MAILING_HELPER,
  MAILING_LABEL,
  PROFILE_SEX_HELPER,
  SHOW_CHILDREN_HELPER,
  SHOW_CHILDREN_LABEL,
  SHOW_CHILDREN_ONLY_ME,
  SHOW_ON_PROFILE,
  childrenDirectoryEnabled,
  emptyMailing,
  franconiaChurchId,
  mailingProblem,
  mailingReady,
  normalizeMailing,
  normalizeShowChildren,
  profileSaveBody,
  profileSex,
  profileVisibility,
  type MailingDraft,
  type ProfileSex,
} from '@/lib/profileForm';
import { fileToImageDataUrl } from '@/lib/profilePhoto';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Copy, HelpCircle, LogOut, Settings, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const satisfies ReadonlyArray<{ value: ProfileSex; label: string }>;

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const serverSex = profileSex(user?.sex);
  const visibility = profileVisibility(user?.profileVisibility);
  const serverMailing = useMemo<MailingDraft>(
    () =>
      user?.mailingKnown
        ? normalizeMailing({
            street: user.mailingStreet ?? '',
            street2: user.mailingStreet2 ?? '',
            city: user.mailingCity ?? '',
            state: user.mailingState ?? '',
            postal: user.mailingPostal ?? '',
            show: Boolean(user.showMailingAddress),
          })
        : emptyMailing(),
    [
      user?.mailingKnown,
      user?.mailingStreet,
      user?.mailingStreet2,
      user?.mailingCity,
      user?.mailingState,
      user?.mailingPostal,
      user?.showMailingAddress,
    ],
  );
  const serverShowChildren = user?.showHouseholdKnown
    ? Boolean(user.showHouseholdInDirectory)
    : false;
  const [sex, setSex] = useState<ProfileSex>(serverSex);
  const [mailing, setMailing] = useState<MailingDraft>(serverMailing);
  const [showChildren, setShowChildren] = useState(serverShowChildren);
  const [acceptedMailing, setAcceptedMailing] = useState<MailingDraft | null>(null);
  const [acceptedChildren, setAcceptedChildren] = useState<boolean | null>(null);
  const formEdited = useRef(false);

  useEffect(() => {
    if (formEdited.current) {
      return;
    }
    setSex(serverSex);
    if (user?.mailingKnown) {
      setMailing(serverMailing);
    }
    if (user?.showHouseholdKnown) {
      setShowChildren(serverShowChildren);
    }
  }, [serverSex, serverMailing, serverShowChildren, user?.mailingKnown, user?.showHouseholdKnown]);

  const chooseSex = (value: ProfileSex) => {
    formEdited.current = true;
    setSex(value);
  };

  const updateMailing = (patch: Partial<MailingDraft>) => {
    formEdited.current = true;
    setMailing((current) => {
      const next = { ...current, ...patch };
      if (!mailingReady(next)) {
        next.show = false;
      }
      return next;
    });
  };

  const savedMailing = normalizeMailing(mailing);
  const savedShowChildren = normalizeShowChildren(visibility, showChildren);
  const baselineMailing = user?.mailingKnown ? serverMailing : (acceptedMailing ?? emptyMailing());
  const baselineShowChildren = user?.showHouseholdKnown
    ? normalizeShowChildren(visibility, serverShowChildren)
    : (acceptedChildren ?? false);
  const dirty =
    sex !== serverSex ||
    JSON.stringify(savedMailing) !== JSON.stringify(baselineMailing) ||
    savedShowChildren !== baselineShowChildren;

  const addressError = mailingProblem(mailing);

  const handleSave = async () => {
    if (!user || saving || !dirty) {
      return;
    }
    if (addressError) {
      toast({
        title: 'Check the mailing address',
        description: addressError,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      let churchId = franconiaChurchId(user.church);
      if (churchId == null) {
        try {
          const listed = await apiRequest(
            'GET',
            `/api/churches/?q=${encodeURIComponent(FRANCONIA_CHURCH_NAME)}`,
          );
          if (listed.ok) {
            const body = (await listed.json()) as unknown;
            churchId = franconiaChurchId(null, Array.isArray(body) ? body : []);
          }
        } catch {
          churchId = null;
        }
      }
      const response = await apiRequest(
        'PATCH',
        API_ROUTES.USER_PROFILE,
        profileSaveBody({
          sex,
          churchId,
          mailing,
          showHouseholdInDirectory: showChildren,
          visibility,
        }),
      );
      if (!response.ok) {
        throw new Error('Failed to save profile');
      }
      formEdited.current = false;
      setAcceptedMailing(normalizeMailing(mailing));
      setAcceptedChildren(normalizeShowChildren(visibility, showChildren));
      await queryClient.invalidateQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
      toast({ title: 'Profile saved' });
    } catch (error) {
      console.error('Profile save failed:', error);
      toast({
        title: 'Could not save profile',
        description: 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (file: File | undefined) => {
    if (!file || uploadingPhoto) {
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await fileToImageDataUrl(file);
      const response = await apiRequest('PATCH', API_ROUTES.USER_PROFILE, { avatar_url: dataUrl });
      if (!response.ok) {
        throw new Error('Failed to save profile photo');
      }
      setAvatarPreview(dataUrl);
      await queryClient.invalidateQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
    } catch (error) {
      setAvatarPreview(null);
      console.error('Profile photo upload failed:', error);
      toast({
        title: 'Could not update your photo',
        description:
          error instanceof Error ? error.message : 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingPhoto(false);
      if (photoInput.current) {
        photoInput.current.value = '';
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
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
    <div className="bg-background min-h-screen pb-[calc(var(--bottom-nav-offset)+1rem)]">
      {/* Header with Profile Info */}
      <div className="bg-[#f6f1ee] px-5 pb-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-[17px] font-semibold">Profile</h1>
          <button
            type="button"
            className={`min-h-11 font-semibold disabled:opacity-60 ${
              dirty ? 'text-[#a2033f]' : 'text-[#c4b8b4]'
            }`}
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="mb-4 text-center">
          <Avatar className="mx-auto h-20 w-20">
            <AvatarImage src={avatarPreview || user.profileImageUrl || undefined} />
            <AvatarFallback className="bg-[#222222] text-2xl text-white">{initials}</AvatarFallback>
          </Avatar>
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Change profile photo"
            onChange={(event) => void handlePhoto(event.target.files?.[0])}
          />
          <button
            type="button"
            className="mt-2 min-h-11 font-semibold text-[#a2033f] disabled:opacity-60"
            disabled={uploadingPhoto}
            onClick={() => photoInput.current?.click()}
          >
            {uploadingPhoto ? 'Saving photo…' : 'Change profile photo'}
          </button>
        </div>
        <label className="mb-3 block text-sm font-semibold">
          Name
          <input
            className="mt-1 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3 font-normal"
            defaultValue={[user.firstName, user.lastName].filter(Boolean).join(' ')}
            aria-label="Name"
          />
        </label>
        <label className="mb-3 block text-sm font-semibold">
          Birth date
          <input
            className="mt-1 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3 font-normal"
            defaultValue={user.dateOfBirth ?? ''}
            placeholder="YYYY-MM-DD"
            aria-label="Birth date"
          />
        </label>
        <p className="mb-1 text-sm font-semibold" id="profile-sex-label">
          Sex
        </p>
        <div className="mb-1 flex gap-2" role="radiogroup" aria-labelledby="profile-sex-label">
          {SEX_OPTIONS.map((option) => {
            const selected = sex === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving}
                onClick={() => chooseSex(option.value)}
                className={`min-h-11 rounded-lg px-4 py-2 ${
                  selected ? 'bg-white font-semibold text-[#a2033f]' : 'text-[#6e6a68]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mb-3 text-xs text-[#6e6a68]">{PROFILE_SEX_HELPER}</p>
        <p className="mb-1 text-[11.5px] font-bold tracking-wide text-[#6e6a68]">CHURCH</p>
        <p className="text-[15px] text-[#222222]">{FRANCONIA_CHURCH_NAME}</p>
        <p className="mb-3 mt-1 text-xs text-[#6e6a68]">This app is for Franconia.</p>
        <Link
          to="/app/household"
          className="flex items-center justify-between rounded-2xl bg-white px-4 py-4 shadow-sm"
        >
          <span className="font-semibold">Household</span>
          <span className="text-sm text-[#6e6a68]">
            {user.householdChildCount == null
              ? 'Children'
              : user.householdChildCount === 1
                ? '1 child'
                : `${user.householdChildCount} children`}
          </span>
        </Link>
        <div className="mt-3 rounded-2xl bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{SHOW_CHILDREN_LABEL}</p>
            <button
              type="button"
              role="switch"
              aria-checked={savedShowChildren}
              aria-label={SHOW_CHILDREN_LABEL}
              disabled={!childrenDirectoryEnabled(visibility) || saving}
              onClick={() => {
                formEdited.current = true;
                setShowChildren((current) => !current);
              }}
              className={`min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold ${
                savedShowChildren ? 'bg-[#a2033f] text-white' : 'bg-[#f6f1ee] text-[#6e6a68]'
              } disabled:opacity-50`}
            >
              {savedShowChildren ? 'On' : 'Off'}
            </button>
          </div>
          <p className="mt-2 text-xs text-[#6e6a68]">
            {childrenDirectoryEnabled(visibility) ? SHOW_CHILDREN_HELPER : SHOW_CHILDREN_ONLY_ME}
          </p>
        </div>
        <p className="mb-1 mt-4 text-[11.5px] font-bold tracking-wide text-[#6e6a68]">CONTACT</p>
        <label className="mb-3 block text-sm font-semibold">
          {MAILING_LABEL}
          <input
            className="mt-1 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3 font-normal"
            value={mailing.street}
            aria-label="Street"
            placeholder="Street"
            onChange={(event) => updateMailing({ street: event.target.value })}
          />
        </label>
        <label className="mb-3 block text-sm font-semibold">
          Apt / suite
          <input
            className="mt-1 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3 font-normal"
            value={mailing.street2}
            aria-label="Apt / suite"
            placeholder="Apt / suite"
            onChange={(event) => updateMailing({ street2: event.target.value })}
          />
        </label>
        <label className="mb-3 block text-sm font-semibold">
          City
          <input
            className="mt-1 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3 font-normal"
            value={mailing.city}
            aria-label="Mailing city"
            placeholder="City"
            onChange={(event) => updateMailing({ city: event.target.value })}
          />
        </label>
        <div className="mb-3 flex gap-2">
          <label className="block flex-1 text-sm font-semibold">
            State
            <input
              className="mt-1 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3 font-normal uppercase"
              value={mailing.state}
              aria-label="State"
              placeholder="PA"
              maxLength={2}
              onChange={(event) => updateMailing({ state: event.target.value.toUpperCase() })}
            />
          </label>
          <label className="block flex-1 text-sm font-semibold">
            ZIP
            <input
              className="mt-1 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3 font-normal"
              value={mailing.postal}
              aria-label="ZIP"
              placeholder="18964"
              inputMode="numeric"
              onChange={(event) => updateMailing({ postal: event.target.value })}
            />
          </label>
        </div>
        {addressError ? <p className="mb-2 text-xs text-[#a2033f]">{addressError}</p> : null}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{SHOW_ON_PROFILE}</p>
          <button
            type="button"
            role="switch"
            aria-checked={savedMailing.show}
            aria-label={`${MAILING_LABEL}: ${SHOW_ON_PROFILE}`}
            disabled={!mailingReady(mailing) || saving}
            onClick={() => updateMailing({ show: !mailing.show })}
            className={`min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold ${
              savedMailing.show ? 'bg-[#a2033f] text-white' : 'bg-white text-[#6e6a68]'
            } disabled:opacity-50`}
          >
            {savedMailing.show ? 'On' : 'Off'}
          </button>
        </div>
        <p className="mb-3 text-xs text-[#6e6a68]">{MAILING_HELPER}</p>
        <p className="mb-2 mt-4 text-[11.5px] font-bold tracking-wide text-[#6e6a68]">CALENDAR</p>
        <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f9e8ee] text-[#a2033f]">
              <Calendar className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="font-semibold text-[#222222]">Church calendar</p>
          </div>
          <p className="mt-3 text-[15px] leading-snug text-[#6e6a68]">
            Subscribe to see every Franconia gathering in your own calendar. It updates
            automatically.
          </p>
          <button
            type="button"
            className="mt-4 h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white"
            onClick={() => openCalendarUrl(churchSubscribeUrl())}
          >
            Subscribe to church calendar
          </button>
          <p className="mt-3 text-sm leading-5 text-[#6e6a68]">
            Opens in Apple Calendar, or copy the link for Google or Outlook.
          </p>
          <button
            type="button"
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 font-semibold text-[#a2033f]"
            onClick={() => {
              void copyChurchCalendarLink()
                .then(() => {
                  setLinkCopied(true);
                  window.setTimeout(() => setLinkCopied(false), 2000);
                })
                .catch(() => setLinkCopied(false));
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy link
          </button>
          {linkCopied ? <p className="text-center text-sm text-[#6e6a68]">Link copied</p> : null}
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowFriendsModal(true)}
          >
            <Users className="w-4 h-4 mr-2" />
            Connections
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate('/app/settings')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate('/app/help-support')}
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Help & Support
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Modals */}
      <FriendsModal isOpen={showFriendsModal} onClose={() => setShowFriendsModal(false)} />
    </div>
  );
}
