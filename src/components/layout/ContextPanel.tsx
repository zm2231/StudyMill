'use client';

import { ReactNode, useState } from 'react';
import { 
  Stack, 
  Tabs, 
  Text, 
  ActionIcon, 
  ScrollArea,
  Badge,
  Button,
  Group,
  Card,
  Divider
} from '@mantine/core';
import { 
  IconX, 
  IconMessageCircle, 
  IconBulb, 
  IconLink, 
  IconBolt,
  IconSparkles,
  IconFileText,
  IconBrain,
  IconCards
} from '@tabler/icons-react';

interface ContextPanelProps {
  onClose: () => void;
  content?: ReactNode;
  defaultTab?: string;
}

interface ContextPanelTab {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  content: ReactNode;
  badge?: string | number;
}

// Phase 1 Context Panel Tabs as per component specifications
const ChatTabContent = () => (
  <Stack gap="md">
    <Text size="sm" c="dimmed">Start a conversation about this content</Text>
    {/* TODO: Integrate with chat interface */}
    <Card p="md" withBorder>
      <Text size="sm">Chat interface will be integrated here</Text>
    </Card>
  </Stack>
);

const SuggestionsTabContent = () => (
  <Stack gap="md">
    <Text size="sm" c="dimmed">AI-powered suggestions</Text>
    <Stack gap="xs">
      {[
        { text: "Create study guide from this section", action: "Generate" },
        { text: "Generate flashcards for key concepts", action: "Create" },
        { text: "Summarize main points", action: "Summarize" }
      ].map((suggestion, index) => (
        <Card key={index} p="sm" withBorder style={{ cursor: 'pointer' }}>
          <Group justify="space-between">
            <Text size="sm">{suggestion.text}</Text>
            <Button size="xs" variant="light" color="forestGreen">
              {suggestion.action}
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  </Stack>
);

const RelatedTabContent = () => (
  <Stack gap="md">
    <Text size="sm" c="dimmed">Related materials</Text>
    <Stack gap="xs">
      {[
        { title: "Chapter 3 Notes", type: "Document", course: "Physics 101" },
        { title: "Newton's Laws Summary", type: "Memory", course: "Physics 101" },
        { title: "Practice Problems Set", type: "Document", course: "Physics 101" }
      ].map((item, index) => (
        <Card key={index} p="sm" withBorder style={{ cursor: 'pointer' }}>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>{item.title}</Text>
              <Badge size="xs" variant="light">{item.type}</Badge>
            </Group>
            <Text size="xs" c="dimmed">{item.course}</Text>
          </Stack>
        </Card>
      ))}
    </Stack>
  </Stack>
);

const QuickActionsTabContent = () => (
  <Stack gap="md">
    <Text size="sm" c="dimmed">Quick actions for this content</Text>
    <Stack gap="sm">
      <Button
        fullWidth
        leftSection={<IconFileText size={16} />}
        variant="light"
        color="forestGreen"
        justify="start"
      >
        Summarize
      </Button>
      <Button
        fullWidth
        leftSection={<IconBrain size={16} />}
        variant="light"
        color="blue"
        justify="start"
      >
        Generate Study Guide
      </Button>
      <Button
        fullWidth
        leftSection={<IconCards size={16} />}
        variant="light"
        color="orange"
        justify="start"
      >
        Create Flashcards
      </Button>
    </Stack>
  </Stack>
);

export function ContextPanel({ onClose, content, defaultTab = 'chat' }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Phase 1 Context Panel tabs as per specifications
  const contextTabs: ContextPanelTab[] = [
    {
      id: 'chat',
      label: 'Chat',
      icon: IconMessageCircle,
      content: content || <ChatTabContent />,
    },
    {
      id: 'suggestions',
      label: 'Suggestions',
      icon: IconBulb,
      content: <SuggestionsTabContent />,
      badge: 3
    },
    {
      id: 'related',
      label: 'Related',
      icon: IconLink,
      content: <RelatedTabContent />,
    },
    {
      id: 'actions',
      label: 'Quick Actions',
      icon: IconBolt,
      content: <QuickActionsTabContent />,
    }
  ];

  return (
    <Stack h="100%" gap={0}>
      {/* Context Panel Header */}
      <Group p="md" justify="space-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <Group gap="xs">
          <IconSparkles size={20} color="var(--forest-green-primary)" />
          <Text size="md" fw={600}>AI Assistant</Text>
        </Group>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onClose}
          size="sm"
        >
          <IconX size={16} />
        </ActionIcon>
      </Group>

      {/* Context Panel Tabs */}
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'chat')}>
        <Tabs.List px="md" pt="sm">
          {contextTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Tabs.Tab
                key={tab.id}
                value={tab.id}
                leftSection={<Icon size={16} />}
                rightSection={tab.badge && (
                  <Badge size="xs" variant="light" color="forestGreen">
                    {tab.badge}
                  </Badge>
                )}
                style={{
                  fontSize: '13px',
                  padding: '8px 12px'
                }}
              >
                {tab.label}
              </Tabs.Tab>
            );
          })}
        </Tabs.List>

        {/* Tab Content */}
        <ScrollArea flex={1} p="md">
          {contextTabs.map((tab) => (
            <Tabs.Panel key={tab.id} value={tab.id}>
              {tab.content}
            </Tabs.Panel>
          ))}
        </ScrollArea>
      </Tabs>
    </Stack>
  );
}

// Phase 1 Integration Notes:
// - Follows component specification for AI Panel with 4 tabs
// - 360-420px width as specified in AppShell requirements  
// - Chat, Suggestions, Related, Quick Actions tabs implemented
// - Proper Mantine Tabs component usage
// - Badge support for notification counts
// - Collapsible design with close action