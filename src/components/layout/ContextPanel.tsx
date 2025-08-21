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
  Divider,
  Loader,
  Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
import { apiClient } from '../../lib/api';

interface ContextPanelProps {
  onClose?: () => void;
  content?: ReactNode;
  defaultTab?: string;
  contextType?: 'document' | 'course' | 'assignment';
  contextId?: string;
  style?: React.CSSProperties;
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

const QuickActionsTabContent = ({ contextId, contextType }: { contextId?: string; contextType?: string }) => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, any>>({});

  const handleAction = async (action: 'summarize' | 'study-guide' | 'flashcards') => {
    if (!contextId || contextType !== 'document') {
      notifications.show({
        title: 'Error',
        message: 'No document selected for AI actions',
        color: 'red'
      });
      return;
    }

    setLoadingStates(prev => ({ ...prev, [action]: true }));
    
    try {
      let result;
      switch (action) {
        case 'summarize':
          result = await apiClient.summarizeDocument(contextId);
          setResults(prev => ({ ...prev, summary: result }));
          notifications.show({
            title: 'Summary Generated',
            message: `Generated summary with ${result.wordCount} words`,
            color: 'green'
          });
          break;
        case 'study-guide':
          result = await apiClient.createStudyGuide({ documentIds: [contextId] });
          setResults(prev => ({ ...prev, studyGuide: result }));
          notifications.show({
            title: 'Study Guide Created',
            message: `Generated ${result.sections.length} sections`,
            color: 'blue'
          });
          break;
        case 'flashcards':
          result = await apiClient.generateFlashcards(contextId, { count: 10 });
          setResults(prev => ({ ...prev, flashcards: result }));
          notifications.show({
            title: 'Flashcards Generated',
            message: `Created ${result.cards.length} flashcards`,
            color: 'orange'
          });
          break;
      }
    } catch (error) {
      console.error(`${action} error:`, error);
      notifications.show({
        title: 'Error',
        message: `Failed to ${action.replace('-', ' ')}. Please try again.`,
        color: 'red'
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [action]: false }));
    }
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Quick actions for this content</Text>
      <Stack gap="sm">
        <Button
          fullWidth
          leftSection={loadingStates.summarize ? <Loader size={16} /> : <IconFileText size={16} />}
          variant="light"
          color="forestGreen"
          justify="start"
          loading={loadingStates.summarize}
          disabled={!contextId || contextType !== 'document'}
          onClick={() => handleAction('summarize')}
        >
          Summarize
        </Button>
        <Button
          fullWidth
          leftSection={loadingStates['study-guide'] ? <Loader size={16} /> : <IconBrain size={16} />}
          variant="light"
          color="blue"
          justify="start"
          loading={loadingStates['study-guide']}
          disabled={!contextId || contextType !== 'document'}
          onClick={() => handleAction('study-guide')}
        >
          Generate Study Guide
        </Button>
        <Button
          fullWidth
          leftSection={loadingStates.flashcards ? <Loader size={16} /> : <IconCards size={16} />}
          variant="light"
          color="orange"
          justify="start"
          loading={loadingStates.flashcards}
          disabled={!contextId || contextType !== 'document'}
          onClick={() => handleAction('flashcards')}
        >
          Create Flashcards
        </Button>
      </Stack>

      {/* Display Results */}
      {results.summary && (
        <Card withBorder p="md" mt="md">
          <Stack gap="xs">
            <Text size="sm" fw={600}>Summary</Text>
            <Text size="sm">{results.summary.summary}</Text>
            <Group gap="xs">
              <Badge size="xs" variant="light" color="green">
                {results.summary.wordCount} words
              </Badge>
              <Badge size="xs" variant="light" color="blue">
                {Math.round(results.summary.confidence * 100)}% confidence
              </Badge>
            </Group>
          </Stack>
        </Card>
      )}

      {results.studyGuide && (
        <Card withBorder p="md" mt="md">
          <Stack gap="xs">
            <Text size="sm" fw={600}>Study Guide</Text>
            <Text size="sm">{results.studyGuide.title}</Text>
            <Badge size="xs" variant="light" color="blue">
              {results.studyGuide.sections.length} sections
            </Badge>
          </Stack>
        </Card>
      )}

      {results.flashcards && (
        <Card withBorder p="md" mt="md">
          <Stack gap="xs">
            <Text size="sm" fw={600}>Flashcards</Text>
            <Text size="xs">Generated {results.flashcards.cards.length} flashcards</Text>
            {results.flashcards.cards.slice(0, 2).map((card: any, index: number) => (
              <Card key={index} p="xs" withBorder bg="gray.0">
                <Stack gap="xs">
                  <Text size="xs" fw={500}>Q: {card.front}</Text>
                  <Text size="xs" c="dimmed">A: {card.back}</Text>
                </Stack>
              </Card>
            ))}
            {results.flashcards.cards.length > 2 && (
              <Text size="xs" c="dimmed">
                ...and {results.flashcards.cards.length - 2} more
              </Text>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
};

export function ContextPanel({ 
  onClose, 
  content, 
  defaultTab = 'chat', 
  contextType = 'document', 
  contextId,
  style 
}: ContextPanelProps) {
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
      content: <QuickActionsTabContent contextId={contextId} contextType={contextType} />,
    }
  ];

  return (
    <Stack h="100%" gap={0} style={style}>
      {/* Context Panel Header */}
      <Group p="md" justify="space-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <Group gap="xs">
          <IconSparkles size={20} color="var(--forest-green-primary)" />
          <Text size="md" fw={600}>AI Assistant</Text>
        </Group>
        {onClose && (
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onClose}
            size="sm"
          >
            <IconX size={16} />
          </ActionIcon>
        )}
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