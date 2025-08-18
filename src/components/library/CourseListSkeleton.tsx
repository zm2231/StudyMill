'use client';

import { Skeleton, Stack, Group, Box } from '@mantine/core';

interface CourseListSkeletonProps {
  count?: number;
}

/**
 * Skeleton loader for course list items that matches the exact layout
 * of the real course navigation items for a seamless loading experience
 */
export function CourseListSkeleton({ count = 3 }: CourseListSkeletonProps) {
  return (
    <Stack gap={2}>
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          p="xs"
          style={{
            borderRadius: 6,
            marginBottom: 2,
          }}
        >
          <Group justify="space-between" gap="sm">
            {/* Color indicator circle */}
            <Group gap="sm" style={{ flex: 1 }}>
              <Skeleton
                width={12}
                height={12}
                circle
                animate
              />
              
              {/* Course name */}
              <Skeleton
                height={16}
                width={`${Math.random() * 40 + 60}%`} // Random width between 60-100%
                animate
              />
            </Group>
            
            {/* Memory count */}
            <Skeleton
              width={20}
              height={12}
              animate
            />
          </Group>
        </Box>
      ))}
    </Stack>
  );
}

/**
 * Skeleton for individual course item with specific styling
 */
export function CourseItemSkeleton() {
  return (
    <Box
      p="xs"
      style={{
        borderRadius: 6,
        marginBottom: 2,
      }}
    >
      <Group justify="space-between" gap="sm">
        <Group gap="sm" style={{ flex: 1 }}>
          <Skeleton width={12} height={12} circle />
          <Skeleton height={16} width="70%" />
        </Group>
        <Skeleton width={20} height={12} />
      </Group>
    </Box>
  );
}

export default CourseListSkeleton;