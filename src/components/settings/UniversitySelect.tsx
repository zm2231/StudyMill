'use client';

import { Select } from '@mantine/core';
import { IconSchool } from '@tabler/icons-react';
import { UNIVERSITIES } from '@/types/university';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface UniversitySelectProps {
  label?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
}

export function UniversitySelect({
  label = 'University',
  placeholder = 'Select your university',
  description,
  required = false
}: UniversitySelectProps) {
  const { preferences, setUniversity, loading } = useUserPreferences();

  const universityOptions = UNIVERSITIES.map(university => ({
    value: university.id,
    label: university.name
  }));

  return (
    <Select
      label={label}
      placeholder={placeholder}
      description={description}
      value={preferences.universityId}
      onChange={(value) => value && setUniversity(value)}
      data={universityOptions}
      leftSection={<IconSchool size={16} />}
      required={required}
      disabled={loading}
      searchable
      clearable={false}
    />
  );
}
