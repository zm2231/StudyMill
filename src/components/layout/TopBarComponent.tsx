'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Group, 
  ActionIcon, 
  TextInput, 
  Breadcrumbs, 
  Anchor, 
  Text,
  Menu,
  Avatar,
  Switch,
  Divider,
  Tooltip,
  Badge
} from '@mantine/core';
import { 
  IconMenu2, 
  IconSearch, 
  IconCommand, 
  IconUser, 
  IconSettings, 
  IconLogout,
  IconMoon,
  IconSun,
  IconChevronRight,
  IconBell,
  IconLayoutSidebarRightExpand
} from '@tabler/icons-react';
import { useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface TopBarComponentProps {
  onMenuClick: () => void;
  onContextPanelToggle: () => void;
  sidebarCollapsed: boolean;
  contextPanelOpen: boolean;
}

interface BreadcrumbItem {
  title: string;
  href?: string;
}

// Generate breadcrumbs from pathname (max 3 levels as per spec)
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Dashboard
  if (segments.length === 0 || segments[0] === 'dashboard') {
    return [{ title: 'Dashboard', href: '/dashboard' }];
  }

  // Map segments to readable names
  const segmentMap: Record<string, string> = {
    'library': 'Library',
    'courses': 'Courses', 
    'study': 'Study',
    'planner': 'Planner',
    'analytics': 'Analytics',
    'chat': 'Chat',
    'settings': 'Settings',
    'profile': 'Profile'
  };

  breadcrumbs.push({ title: 'Dashboard', href: '/dashboard' });

  // Add up to 2 more levels (max 3 total as per design spec)
  for (let i = 0; i < Math.min(segments.length, 2); i++) {
    const segment = segments[i];
    const title = segmentMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const href = '/' + segments.slice(0, i + 1).join('/');
    breadcrumbs.push({ title, href });
  }

  return breadcrumbs;
}

export function TopBarComponent({ 
  onMenuClick, 
  onContextPanelToggle, 
  sidebarCollapsed,
  contextPanelOpen 
}: TopBarComponentProps) {
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState('');
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const { logout } = useAuth();
  const { preferences } = useUserPreferences();
  const [clock, setClock] = useState('');
  
  const breadcrumbs = generateBreadcrumbs(pathname);

  // Global search hotkey
  useHotkeys('cmd+k,ctrl+k', (e) => {
    e.preventDefault();
    // TODO: Open command palette
    console.log('Open command palette');
  });

  // Focus search hotkey
  useHotkeys('/', (e) => {
    e.preventDefault();
    document.getElementById('global-search')?.focus();
  });

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  // Live clock in user-selected timezone
  useState(() => {
    const fmt = () => {
      try {
        const tz = preferences.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const s = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: tz }).format(new Date());
        setClock(s);
      } catch (e) {
        setClock(new Date().toLocaleTimeString());
      }
    };
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  });

  return (
    <Group h="100%" px="md" justify="space-between">
      {/* Left Section: Menu + Breadcrumbs */}
      <Group gap="md">
        <Tooltip label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onMenuClick}
            size="md"
          >
            <IconMenu2 size={20} />
          </ActionIcon>
        </Tooltip>

        {/* Breadcrumbs (max 3 levels) */}
        <Breadcrumbs 
          separator={<IconChevronRight size={14} color="var(--sanctuary-text-secondary)" />}
          separatorMargin="xs"
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return isLast ? (
              <Text 
                key={item.title}
                size="sm" 
                fw={600} 
                c="var(--sanctuary-text-primary)"
              >
                {item.title}
              </Text>
            ) : (
              <Anchor
                key={item.title}
                component={Link}
                href={item.href || '#'}
                size="sm"
                c="var(--sanctuary-text-secondary)"
                style={{ textDecoration: 'none' }}
              >
                {item.title}
              </Anchor>
            );
          })}
        </Breadcrumbs>
      </Group>

      {/* Center Section: Global Search */}
      <TextInput
        id="global-search"
        placeholder="Search or press Cmd+K"
        leftSection={<IconSearch size={16} />}
        rightSection={
          <Group gap="xs">
            <Badge variant="light" size="xs" color="gray">
              ⌘K
            </Badge>
          </Group>
        }
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        size="sm"
        w={320}
        styles={{
          input: {
            backgroundColor: 'var(--sanctuary-surface)',
            border: '1px solid var(--border-light)',
            '&:focus': {
              borderColor: 'var(--forest-green-primary)',
              backgroundColor: 'var(--sanctuary-card)'
            }
          }
        }}
      />

      {/* Right Section: Actions + User Menu */}
      <Group gap="sm">
        {/* Clock */}
        <Tooltip label={`Timezone: ${preferences.timeZone}`}>
          <Text size="sm" c="var(--sanctuary-text-secondary)" style={{ minWidth: 84, textAlign: 'right' }}>
            {clock}
          </Text>
        </Tooltip>

        {/* Context Panel Toggle */}
        <Tooltip label={contextPanelOpen ? 'Close AI Panel' : 'Open AI Panel'}>
          <ActionIcon
            variant={contextPanelOpen ? 'filled' : 'subtle'}
            color={contextPanelOpen ? 'forestGreen' : 'gray'}
            onClick={onContextPanelToggle}
            size="md"
          >
            <IconLayoutSidebarRightExpand size={20} />
          </ActionIcon>
        </Tooltip>

        {/* Notifications */}
        <Tooltip label="Notifications">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
          >
            <IconBell size={20} />
          </ActionIcon>
        </Tooltip>

        {/* User Menu */}
        <Menu width={200} position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" size="md">
              <Avatar size="sm" color="forestGreen">
                <IconUser size={16} />
              </Avatar>
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Account</Menu.Label>
            
            <Menu.Item 
              leftSection={<IconUser size={16} />}
              component={Link}
              href="/profile"
            >
              Profile
            </Menu.Item>
            
            <Menu.Item 
              leftSection={<IconSettings size={16} />}
              component={Link}
              href="/settings"
            >
              Settings
            </Menu.Item>

            <Divider my="xs" />

            <Menu.Label>Appearance</Menu.Label>
            
            <Menu.Item>
              <Group justify="space-between">
                <Group gap="xs">
                  {computedColorScheme === 'dark' ? (
                    <IconMoon size={16} />
                  ) : (
                    <IconSun size={16} />
                  )}
                  <Text size="sm">Dark mode</Text>
                </Group>
                <Switch
                  checked={computedColorScheme === 'dark'}
                  onChange={toggleColorScheme}
                  size="sm"
                />
              </Group>
            </Menu.Item>

            <Divider my="xs" />

            <Menu.Item 
              leftSection={<IconLogout size={16} />}
              color="red"
              onClick={async () => {
                await logout();
              }}
            >
              Sign out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}

// Phase 1 Integration Notes:
// - 64px height as per AppShell specification
// - Breadcrumbs limited to max 3 levels as per design spec
// - Global search with Cmd+K shortcut integration
// - Context panel toggle with visual state indication
// - User menu with theme toggle integration
// - Proper Mantine component usage throughout
// - Accessible keyboard shortcuts and tooltips