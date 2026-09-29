import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import {
  Bell,
  Calendar,
  Compass,
  HelpCircle,
  Home,
  MessageCircle,
  Plus,
  Settings,
  Sparkles,
  Star,
  User,
  Users,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const PRIMARY_NAV = [
  { to: '/app', label: 'Home', icon: Home, exact: true },
  { to: '/app/discovery', label: 'Discover', icon: Compass },
  { to: '/app/activities', label: 'Gatherings', icon: Calendar },
  { to: '/app/matches', label: 'Chats', icon: MessageCircle },
  { to: '/app/connections', label: 'Connections', icon: Users },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
];

const SECONDARY_NAV = [
  { to: '/app/reviews', label: 'Reviews', icon: Star },
  { to: '/app/vibe-quiz', label: 'Vibe Quiz', icon: Sparkles },
  { to: '/app/moderation', label: 'Safety', icon: HelpCircle },
  { to: '/app/profile', label: 'Profile', icon: User },
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/app/help-support', label: 'Help & Support', icon: HelpCircle },
];

function isActive(currentPath: string, target: string, exact?: boolean) {
  if (exact) return currentPath === target;
  return currentPath === target || currentPath.startsWith(`${target}/`);
}

export default function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/80">
      <SidebarHeader className="px-3 py-4">
        <Link to="/app" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-deep text-white shadow-float">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-display text-[22px] font-bold leading-none tracking-tight">
              The Foyer
            </span>
            <span className="text-[11px] text-muted-foreground">Franconia Mennonite Church</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(location.pathname, '/app/create')}
                  tooltip="Host"
                  className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                >
                  <Link to="/app/create">
                    <Plus className="h-4 w-4" />
                    <span>Host</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRIMARY_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(location.pathname, item.to, item.exact)}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>You</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(location.pathname, item.to)}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={user.firstName ?? 'You'}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {user?.firstName ?? 'Member'} {user?.lastName ?? ''}
            </span>
            <span className="truncate text-xs text-muted-foreground">{user?.email ?? ''}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
