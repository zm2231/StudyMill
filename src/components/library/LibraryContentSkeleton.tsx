'use client';

import { 
  Skeleton, 
  Stack, 
  Group, 
  Box, 
  SimpleGrid, 
  Card 
} from '@mantine/core';

/**
 * Skeleton loader for LibraryContent that matches the exact layout
 * of the real memory cards and content sections
 */
export function LibraryContentSkeleton() {
  return (
    <Stack gap="lg">
      {/* Header Section Skeleton */}
      <Group justify="space-between" align="start" mb="lg">
        <Box style={{ flex: 1 }}>
          <Group align="center" gap="md" mb="lg">
            {/* Course color indicator */}
            <Skeleton width={40} height={40} circle />
            
            {/* Course title */}
            <Skeleton height={40} width="40%" />
          </Group>
          
          {/* Course description */}
          <Skeleton height={20} width="80%" mb="xs" />
          <Skeleton height={20} width="60%" />
        </Box>
        
        {/* Add Memory button */}
        <Skeleton width={120} height={36} radius="md" />
      </Group>

      {/* Content Section Header */}
      <Group justify="space-between" align="center" mb="lg">
        <Skeleton height={24} width={150} />
      </Group>

      {/* Memory Cards Grid */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {Array.from({ length: 6 }).map((_, index) => (
          <MemoryCardSkeleton key={index} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

/**
 * Skeleton for individual memory card
 */
export function MemoryCardSkeleton() {
  return (
    <Card 
      p="lg" 
      radius="md"
      withBorder
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderColor: '#e2e8f0',
        minHeight: 200,
      }}
    >
      <Stack gap="md">
        {/* Card header */}
        <Group justify="space-between" align="start">
          <Skeleton height={20} width="70%" />
          <Skeleton width={20} height={20} circle />
        </Group>
        
        {/* Content preview */}
        <Stack gap="xs">
          <Skeleton height={16} width="100%" />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="75%" />
        </Stack>
        
        {/* Footer */}
        <Group justify="space-between" align="center" mt="auto">
          <Skeleton height={14} width="60%" />
          <Skeleton height={14} width="80px" />
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * Skeleton for overview page with multiple sections
 */
export function OverviewSkeleton() {
  return (
    <Stack gap="xl">
      {/* Today's Classes Section */}
      <Box>
        <Skeleton height={32} width={200} mb="lg" />
        <Card p="lg" radius="md" withBorder>
          <Group justify="space-between" align="start">
            <Box style={{ flex: 1 }}>
              <Skeleton height={20} width="40%" mb="sm" />
              <Skeleton height={16} width="60%" />
            </Box>
            <Stack gap="xs">
              <Skeleton width={100} height={32} radius="md" />
              <Skeleton width={100} height={32} radius="md" />
            </Stack>
          </Group>
        </Card>
      </Box>

      {/* Recent Activity Section */}
      <Box>
        <Skeleton height={32} width={200} mb="lg" />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {Array.from({ length: 3 }).map((_, index) => (
            <MemoryCardSkeleton key={index} />
          ))}
        </SimpleGrid>
      </Box>
    </Stack>
  );
}

export default LibraryContentSkeleton;