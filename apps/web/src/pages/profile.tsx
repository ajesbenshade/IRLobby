import EditProfileModal from '@/components/EditProfileModal';
import FriendsModal from '@/components/FriendsModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { churchSubscribeUrl, copyChurchCalendarLink, openCalendarUrl } from '@/lib/calendar';
import { Edit, Settings, HelpCircle, Star, LogOut, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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
  const eventsHosted = user.eventsHosted ?? 0;
  const eventsAttended = user.eventsAttended ?? 0;

  return (
    <div className="bg-background min-h-screen pb-[calc(var(--bottom-nav-offset)+1rem)]">
      {/* Header with Profile Info */}
      <div className="bg-[#f6f1ee] px-5 pb-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-[17px] font-semibold">Profile</h1>
          <button type="button" className="font-semibold text-[#a2033f]">
            Save
          </button>
        </div>
        <div className="mb-4 text-center">
          <Avatar className="mx-auto h-20 w-20">
            <AvatarImage src={user.profileImageUrl || undefined} />
            <AvatarFallback className="bg-[#222222] text-2xl text-white">{initials}</AvatarFallback>
          </Avatar>
          <p className="mt-2 font-semibold text-[#a2033f]">Change profile photo</p>
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
        <p className="mb-1 text-sm font-semibold">Sex</p>
        <div className="mb-1 flex gap-2">
          <span
            className={`rounded-lg px-4 py-2 ${
              user.sex === 'male' ? 'bg-white font-semibold text-[#a2033f]' : 'text-[#6e6a68]'
            }`}
          >
            Male
          </span>
          <span
            className={`rounded-lg bg-white px-4 py-2 ${
              user.sex === 'female' ? 'font-semibold text-[#a2033f]' : ''
            }`}
          >
            Female
          </span>
        </div>
        <p className="mb-3 text-xs text-[#6e6a68]">Only used for men's or women's events</p>
        <label className="mb-3 block text-sm font-semibold">
          Are you a church member, and where?
          <input
            className="mt-1 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3 font-normal"
            placeholder="Search churches"
            aria-label="Search churches"
          />
        </label>
        <p className="mb-3 text-xs text-[#6e6a68]">Not a member anywhere? Leave this blank.</p>
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
          <p className="font-semibold text-[#222222]">Calendar</p>
          <button
            type="button"
            className="mt-2 block min-h-11 text-left font-semibold text-[#a2033f]"
            onClick={() => openCalendarUrl(churchSubscribeUrl())}
          >
            Subscribe to church calendar
          </button>
          <button
            type="button"
            className="block min-h-11 text-left font-semibold text-[#a2033f]"
            onClick={() => {
              void copyChurchCalendarLink()
                .then(() => {
                  setLinkCopied(true);
                  window.setTimeout(() => setLinkCopied(false), 2000);
                })
                .catch(() => setLinkCopied(false));
            }}
          >
            Copy link
          </button>
          {linkCopied ? <p className="text-sm text-[#6e6a68]">Link copied</p> : null}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Activity Stats */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Activity Stats</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{eventsHosted}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Events Hosted</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {eventsAttended}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Events Attended</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {eventsHosted + eventsAttended}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Activities</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interests */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {user.interests && user.interests.length > 0 ? (
                user.interests.map((interest: string, index: number) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-300"
                  >
                    {interest}
                  </Badge>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No interests added yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowEditModal(true)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>

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
            onClick={() => navigate('/app/reviews')}
          >
            <Star className="w-4 h-4 mr-2" />
            Reviews
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

      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={user}
      />
    </div>
  );
}
