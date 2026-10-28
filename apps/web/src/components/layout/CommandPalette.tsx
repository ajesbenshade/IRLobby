import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Bell,
  Calendar,
  Compass,
  HelpCircle,
  Plus,
  Settings,
  Star,
  User,
} from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NAV = [
  { to: '/app/discovery', label: 'Discover', icon: Compass },
  { to: '/app/gatherings', label: 'Gatherings', icon: Calendar },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
];

const ACTIONS = [
  { to: '/app/host', label: 'Host a gathering', icon: Plus },
  { to: '/app/reviews', label: 'View reviews', icon: Star },
];

const ACCOUNT = [
  { to: '/app/profile', label: 'My profile', icon: User },
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/app/moderation', label: 'Safety & moderation', icon: HelpCircle },
  { to: '/app/help-support', label: 'Help & support', icon: HelpCircle },
];

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.to} onSelect={() => go(item.to)}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {ACTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.to} onSelect={() => go(item.to)}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          {ACCOUNT.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.to} onSelect={() => go(item.to)}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
