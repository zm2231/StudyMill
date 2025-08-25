"use client";

import { Select, Stack, Text } from "@mantine/core";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const commonTimeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export function TimezoneSelect() {
  const { preferences, setTimeZone } = useUserPreferences();

  const tzList = Array.from(new Set([preferences.timeZone, ...commonTimeZones])).filter(Boolean);

  return (
    <Stack gap="xs">
      <Select
        label="Timezone"
        placeholder="Select your timezone"
        data={tzList.map((tz) => ({ value: tz, label: tz }))}
        value={preferences.timeZone}
        searchable
        nothingFoundMessage="No timezones found"
        onChange={(v) => v && setTimeZone(v)}
      />
      <Text size="xs" c="dimmed">
        Current time: {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: preferences.timeZone }).format(new Date())}
      </Text>
    </Stack>
  );
}

