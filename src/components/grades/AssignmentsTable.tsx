'use client';

import { Table, Badge, Text, Group, Collapse, Button, Stack } from '@mantine/core';
import { useState } from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { GradeAssignment, formatDueDate, groupAssignmentsByCategory } from '@/lib/api/grades';

interface AssignmentsTableProps {
  assignments: GradeAssignment[];
  groupByCategory?: boolean;
}

export function AssignmentsTable({ 
  assignments, 
  groupByCategory = true 
}: AssignmentsTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };
  
  const getStatusColor = (assignment: GradeAssignment) => {
    if (assignment.isGraded) return 'green';
    if (assignment.isPastDue) return 'red';
    if (assignment.status === 'in_progress') return 'blue';
    return 'gray';
  };
  
  const getStatusLabel = (assignment: GradeAssignment) => {
    if (assignment.isGraded) return 'Graded';
    if (assignment.isPastDue) return 'Overdue';
    if (assignment.status === 'in_progress') return 'In Progress';
    return 'Not Started';
  };
  
  const renderAssignmentRow = (assignment: GradeAssignment) => (
    <Table.Tr key={assignment.id}>
      <Table.Td>
        <Text fw={500}>{assignment.title}</Text>
        {assignment.type && (
          <Badge size="xs" variant="light" mt={4}>
            {assignment.type}
          </Badge>
        )}
      </Table.Td>
      
      <Table.Td>
        <Text size="sm" c={assignment.isPastDue ? 'red' : undefined}>
          {formatDueDate(assignment.due_date)}
        </Text>
      </Table.Td>
      
      <Table.Td>
        {assignment.isGraded ? (
          <Group gap="xs">
            <Text fw={500}>
              {assignment.points_earned?.toFixed(1) || '—'}
            </Text>
            <Text c="dimmed">/</Text>
            <Text>{assignment.points_possible?.toFixed(1) || '—'}</Text>
          </Group>
        ) : (
          <Text c="dimmed" size="sm">
            {assignment.points ? `${assignment.points} pts` : '—'}
          </Text>
        )}
      </Table.Td>
      
      <Table.Td>
        {assignment.percentScore !== null && assignment.percentScore !== undefined ? (
          <Text 
            fw={500}
            c={
              assignment.percentScore >= 90 ? 'green' :
              assignment.percentScore >= 80 ? 'blue' :
              assignment.percentScore >= 70 ? 'yellow' :
              assignment.percentScore >= 60 ? 'orange' :
              'red'
            }
          >
            {assignment.percentScore.toFixed(1)}%
          </Text>
        ) : (
          <Text c="dimmed">—</Text>
        )}
      </Table.Td>
      
      <Table.Td>
        <Badge 
          size="sm" 
          variant="light"
          color={getStatusColor(assignment)}
        >
          {getStatusLabel(assignment)}
        </Badge>
      </Table.Td>
    </Table.Tr>
  );
  
  if (!groupByCategory) {
    // Simple table without grouping
    return (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Assignment</Table.Th>
            <Table.Th>Due Date</Table.Th>
            <Table.Th>Points</Table.Th>
            <Table.Th>Score</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {assignments.map(renderAssignmentRow)}
          {assignments.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text ta="center" c="dimmed" py="lg">
                  No assignments found
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    );
  }
  
  // Grouped by category
  const grouped = groupAssignmentsByCategory(assignments);
  const categories = Array.from(grouped.keys());
  
  return (
    <Stack gap="md">
      {categories.map(category => {
        const categoryAssignments = grouped.get(category) || [];
        const isExpanded = expandedCategories.has(category);
        const gradedCount = categoryAssignments.filter(a => a.isGraded).length;
        
        return (
          <div key={category}>
            <Button
              variant="subtle"
              size="sm"
              fullWidth
              justify="space-between"
              rightSection={
                isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />
              }
              onClick={() => toggleCategory(category)}
              mb="xs"
            >
              <Group gap="sm">
                <Text fw={600}>{category}</Text>
                <Badge size="sm" variant="light">
                  {gradedCount}/{categoryAssignments.length} graded
                </Badge>
              </Group>
            </Button>
            
            <Collapse in={isExpanded}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Assignment</Table.Th>
                    <Table.Th>Due Date</Table.Th>
                    <Table.Th>Points</Table.Th>
                    <Table.Th>Score</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {categoryAssignments.map(renderAssignmentRow)}
                </Table.Tbody>
              </Table>
            </Collapse>
          </div>
        );
      })}
      
      {categories.length === 0 && (
        <Text ta="center" c="dimmed" py="xl">
          No assignments found. Upload a syllabus to extract assignments automatically.
        </Text>
      )}
    </Stack>
  );
}
