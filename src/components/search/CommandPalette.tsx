"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, TextInput, List, ThemeIcon, Text, Group } from "@mantine/core";
import { IconSearch, IconFileText, IconBrain, IconBooks, IconSchool } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

interface CommandPaletteProps {
  opened: boolean;
  initialQuery?: string;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  type: "document" | "memory" | "course" | string;
  title: string;
  subtitle?: string;
}

export function CommandPalette({ opened, initialQuery = "", onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery, opened]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query || query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        setLoading(true);
        // Use quick search endpoint; fallback minimal parsing
        const res = await apiClient.request<any>(`/api/v1/search/quick?${new URLSearchParams({ q: query, type: 'unified', limit: '8' })}`);
        const items: SearchItem[] = (res.results || []).map((r: any) => ({
          id: r.id || r.memory?.id || r.documentId || crypto.randomUUID(),
          type: r.type || r.kind || r.memory ? 'memory' : 'document',
          title: r.title || r.memory?.content?.slice(0, 80) || r.text?.slice(0, 80) || 'Result',
          subtitle: r.metadata?.document_title || r.courseName || undefined,
        }));
        setResults(items);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const iconForType = (type: string) => {
    switch (type) {
      case "document":
        return <IconFileText size={16} />;
      case "memory":
        return <IconBrain size={16} />;
      case "course":
        return <IconSchool size={16} />;
      default:
        return <IconSearch size={16} />;
    }
  };

  const handleSelect = (item: SearchItem) => {
    if (item.type === "document") {
      router.push(`/documents/${item.id}`);
    } else if (item.type === "memory") {
      router.push(`/library?highlight=${encodeURIComponent(item.id)}`);
    } else if (item.type === "course") {
      router.push(`/courses?courseId=${encodeURIComponent(item.id)}`);
    } else {
      router.push(`/library?query=${encodeURIComponent(item.title)}`);
    }
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Quick Search" centered size="lg">
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Type to search across documents and memories..."
        leftSection={<IconSearch size={16} />}
        autoFocus
      />
      <List spacing="sm" mt="md" withPadding>
        {results.map((item) => (
          <List.Item
            key={item.id}
            icon={<ThemeIcon variant="light" size={24}>{iconForType(item.type)}</ThemeIcon>}
            onClick={() => handleSelect(item)}
            style={{ cursor: 'pointer' }}
          >
            <Group gap="xs">
              <Text fw={500}>{item.title}</Text>
              {item.subtitle && (
                <Text size="xs" c="dimmed">{item.subtitle}</Text>
              )}
            </Group>
          </List.Item>
        ))}
        {!loading && query && results.length === 0 && (
          <List.Item icon={<ThemeIcon variant="light" size={24}><IconBooks size={16} /></ThemeIcon>}>
            <Text size="sm" c="dimmed">No results. Try a different query.</Text>
          </List.Item>
        )}
      </List>
    </Modal>
  );
}

