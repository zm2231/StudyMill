'use client';

import { Table, Badge, Text, Progress, Group, Tooltip } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { GradeWeight, CategoryStats, formatPercentage } from '@/lib/api/grades';

interface GradeWeightsTableProps {
  weights: GradeWeight[];
  categoryStats: CategoryStats[];
}

export function GradeWeightsTable({ weights, categoryStats }: GradeWeightsTableProps) {
  // Create a map for quick lookup of category stats
  const statsMap = new Map(categoryStats.map(s => [s.category, s]));
  
  // Calculate total weight to check if it equals 100%
  const totalWeight = weights.reduce((sum, w) => sum + w.weight_pct, 0);
  const isValidTotal = Math.abs(totalWeight - 1.0) < 0.01;
  
  // Calculate current weighted grade
  const currentWeightedGrade = categoryStats
    .filter(s => s.gradedCount > 0)
    .reduce((sum, s) => sum + s.weightedScore, 0);
  
  const totalWeightUsed = categoryStats
    .filter(s => s.gradedCount > 0)
    .reduce((sum, s) => sum + s.weight, 0);
  
  const rows = weights.map((weight) => {
    const stats = statsMap.get(weight.name);
    const hasGrades = stats && stats.gradedCount > 0;
    
    return (
      <Table.Tr key={weight.id}>
        <Table.Td>
          <Text fw={500}>{weight.name}</Text>
          {stats && stats.assignmentCount > 0 && (
            <Text size="xs" c="dimmed">
              {stats.gradedCount}/{stats.assignmentCount} graded
            </Text>
          )}
        </Table.Td>
        
        <Table.Td>
          <Badge size="lg" variant="light">
            {formatPercentage(weight.weight_pct)}
          </Badge>
        </Table.Td>
        
        <Table.Td>
          {stats && hasGrades ? (
            <Group gap="xs">
              <Text>{stats.earnedPoints.toFixed(1)}</Text>
              <Text c="dimmed">/</Text>
              <Text>{stats.possiblePoints.toFixed(1)}</Text>
            </Group>
          ) : (
            <Text c="dimmed" size="sm">No grades yet</Text>
          )}
        </Table.Td>
        
        <Table.Td>
          {stats && hasGrades ? (
            <Group gap="xs">
              <Progress 
                value={stats.percentage} 
                size="sm" 
                w={80}
                color={
                  stats.percentage >= 90 ? 'green' :
                  stats.percentage >= 80 ? 'blue' :
                  stats.percentage >= 70 ? 'yellow' :
                  stats.percentage >= 60 ? 'orange' :
                  'red'
                }
              />
              <Text size="sm" fw={500}>
                {stats.percentage.toFixed(1)}%
              </Text>
            </Group>
          ) : (
            <Text c="dimmed" size="sm">—</Text>
          )}
        </Table.Td>
        
        <Table.Td>
          {stats && hasGrades ? (
            <Text fw={500}>
              {stats.weightedScore.toFixed(2)}%
            </Text>
          ) : (
            <Text c="dimmed" size="sm">—</Text>
          )}
        </Table.Td>
      </Table.Tr>
    );
  });
  
  return (
    <>
      {!isValidTotal && (
        <Group gap="sm" mb="md">
          <IconAlertCircle size={20} color="var(--mantine-color-orange-6)" />
          <Text c="orange" size="sm">
            Grade weights sum to {formatPercentage(totalWeight)}, not 100%. 
            Grades may not be calculated accurately.
          </Text>
        </Group>
      )}
      
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Category</Table.Th>
            <Table.Th>Weight</Table.Th>
            <Table.Th>Points</Table.Th>
            <Table.Th>Percentage</Table.Th>
            <Table.Th>
              <Tooltip label="Contribution to final grade">
                <Text inherit>Weighted</Text>
              </Tooltip>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows}
          
          {/* Total row */}
          <Table.Tr style={{ borderTop: '2px solid var(--mantine-color-gray-3)' }}>
            <Table.Td>
              <Text fw={600}>Total</Text>
            </Table.Td>
            <Table.Td>
              <Badge 
                size="lg" 
                variant="filled"
                color={isValidTotal ? 'green' : 'orange'}
              >
                {formatPercentage(totalWeight)}
              </Badge>
            </Table.Td>
            <Table.Td colSpan={2}>
              <Text c="dimmed" size="sm">
                {formatPercentage(totalWeightUsed)} of grade earned
              </Text>
            </Table.Td>
            <Table.Td>
              <Text fw={600} size="lg">
                {totalWeightUsed > 0 
                  ? `${(currentWeightedGrade / totalWeightUsed).toFixed(1)}%`
                  : '—'
                }
              </Text>
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </>
  );
}
