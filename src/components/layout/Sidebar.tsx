'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  IconBooks, 
  IconSchool, 
  IconBrain, 
  IconCalendar, 
  IconChartBar,
  IconPlus,
  IconChevronLeft,
  IconHome,
  IconSettings,
  IconUser,
  IconLogout,
  IconClock
} from '@tabler/icons-react';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { DocumentUploader } from '@/components/upload/DocumentUploader';
import { TimerMini } from '@/components/timer/TimerMini';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  mobile?: boolean;
  onTimerMaximize?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  description: string;
  count?: number;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: IconHome,
    description: 'Your study overview'
  },
  {
    label: 'Library', 
    href: '/library',
    icon: IconBooks,
    description: 'All documents & materials'
  },
  {
    label: 'Courses',
    href: '/courses', 
    icon: IconSchool,
    description: 'Course management'
  },
  {
    label: 'Study',
    href: '/study',
    icon: IconBrain,
    description: 'Flashcards & review'
  },
  {
    label: 'Planner',
    href: '/planner',
    icon: IconCalendar, 
    description: 'Schedule & deadlines'
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: IconChartBar,
    description: 'Progress tracking'
  }
];

export function Sidebar({ collapsed, onCollapse, mobile = false, onTimerMaximize }: SidebarProps) {
  const pathname = usePathname();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const documentUpload = useDocumentUpload();

  const sidebarWidth = collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)';

  return (
    <>
      <aside
        data-collapsed={collapsed}
        className={`
          fixed top-16 left-0 h-[calc(100vh-4rem)] bg-[var(--sanctuary-card)] 
          border-r border-[var(--border-light)] z-30 transition-all duration-[var(--transition-medium)]
          ${mobile ? 'transform' : ''}
          ${mobile && collapsed ? '-translate-x-full' : ''}
        `}
        style={{ width: sidebarWidth }}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
            {!collapsed && (
              <h2 className="font-semibold text-[var(--sanctuary-text-primary)]">
                StudyMill
              </h2>
            )}
            <button
              onClick={() => onCollapse(!collapsed)}
              className="p-2 rounded-md hover:bg-[var(--sanctuary-surface)] transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <IconChevronLeft 
                size={20} 
                className={`transition-transform duration-[var(--transition-medium)] ${
                  collapsed ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Quick Add Button */}
          <div className="p-4 border-b border-[var(--border-light)]">
            <button
              onClick={() => setShowQuickAdd(true)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg
                bg-[var(--forest-green-primary)] text-white
                hover:bg-[#3D6622] transition-all duration-[var(--transition-fast)]
                hover:shadow-md hover:scale-[1.02]
                ${collapsed ? 'justify-center' : ''}
              `}
              title="Quick Add"
            >
              <IconPlus size={20} />
              {!collapsed && <span className="font-medium">Quick Add</span>}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg transition-all duration-[var(--transition-fast)]
                    hover:bg-[var(--sanctuary-surface)] hover:scale-[1.02]
                    ${isActive 
                      ? 'bg-[var(--forest-green-light)]/20 text-[var(--forest-green-primary)] border border-[var(--forest-green-light)]' 
                      : 'text-[var(--sanctuary-text-secondary)] hover:text-[var(--sanctuary-text-primary)]'
                    }
                    ${collapsed ? 'justify-center' : ''}
                  `}
                  title={collapsed ? item.label : item.description}
                >
                  <Icon size={20} />
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-[var(--sanctuary-text-secondary)] truncate">
                        {item.description}
                      </div>
                    </div>
                  )}
                  {!collapsed && item.count && (
                    <span className="px-2 py-1 text-xs bg-[var(--sanctuary-surface)] rounded-full">
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Timer Mini (when active) */}
          <TimerMini onMaximize={onTimerMaximize} />

          {/* User Section */}
          <div className="p-4 border-t border-[var(--border-light)] space-y-2">
            <Link
              href="/profile"
              className={`
                flex items-center gap-3 p-3 rounded-lg
                text-[var(--sanctuary-text-secondary)] hover:text-[var(--sanctuary-text-primary)]
                hover:bg-[var(--sanctuary-surface)] transition-all duration-[var(--transition-fast)]
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? 'Profile' : 'User profile'}
            >
              <IconUser size={20} />
              {!collapsed && <span>Profile</span>}
            </Link>

            <Link
              href="/settings"
              className={`
                flex items-center gap-3 p-3 rounded-lg
                text-[var(--sanctuary-text-secondary)] hover:text-[var(--sanctuary-text-primary)]
                hover:bg-[var(--sanctuary-surface)] transition-all duration-[var(--transition-fast)]
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? 'Settings' : 'Application settings'}
            >
              <IconSettings size={20} />
              {!collapsed && <span>Settings</span>}
            </Link>

            <button
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg
                text-[var(--muted-terracotta)] hover:text-red-600
                hover:bg-[var(--sanctuary-surface)] transition-all duration-[var(--transition-fast)]
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? 'Sign out' : 'Sign out of StudyMill'}
            >
              <IconLogout size={20} />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--sanctuary-card)] rounded-xl p-6 w-full max-w-md border border-[var(--border-light)]">
            <h3 className="text-lg font-semibold text-[var(--sanctuary-text-primary)] mb-4">
              Quick Add
            </h3>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  setShowQuickAdd(false);
                  documentUpload.open();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border-light)] hover:bg-[var(--sanctuary-surface)] transition-colors"
              >
                <IconBooks size={20} />
                <div className="text-left">
                  <div className="font-medium">Upload Document</div>
                  <div className="text-sm text-[var(--sanctuary-text-secondary)]">PDF, DOCX, or text files</div>
                </div>
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border-light)] hover:bg-[var(--sanctuary-surface)] transition-colors">
                <IconSchool size={20} />
                <div className="text-left">
                  <div className="font-medium">New Course</div>
                  <div className="text-sm text-[var(--sanctuary-text-secondary)]">Create a course to organize materials</div>
                </div>
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border-light)] hover:bg-[var(--sanctuary-surface)] transition-colors">
                <IconCalendar size={20} />
                <div className="text-left">
                  <div className="font-medium">Add Event</div>
                  <div className="text-sm text-[var(--sanctuary-text-secondary)]">Schedule study time or deadlines</div>
                </div>
              </button>
              <button 
                onClick={() => {
                  setShowQuickAdd(false);
                  onTimerMaximize?.();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border-light)] hover:bg-[var(--sanctuary-surface)] transition-colors"
              >
                <IconClock size={20} />
                <div className="text-left">
                  <div className="font-medium">Focus Timer</div>
                  <div className="text-sm text-[var(--sanctuary-text-secondary)]">Start a Pomodoro session</div>
                </div>
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2 text-[var(--sanctuary-text-secondary)] hover:text-[var(--sanctuary-text-primary)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Document Uploader */}
      <DocumentUploader
        opened={documentUpload.isOpen}
        onClose={documentUpload.close}
        preselectedCourseId={documentUpload.preselectedCourseId}
        onSuccess={documentUpload.handleSuccess}
        onError={documentUpload.handleError}
      />
    </>
  );
}