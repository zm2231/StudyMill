"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Stack, Loader, Alert, Title, Group, Text, rem } from "@mantine/core";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { IconAlertTriangle, IconCalendar } from "@tabler/icons-react";
import { getAssignmentsByWeek, type WeekBucket } from "@/lib/api/planner";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  semesterId: string;
}

interface RbcEvent {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: any;
}

export function CalendarView({ semesterId }: CalendarViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<RbcEvent[]>([]);
  const [defaultDate, setDefaultDate] = useState<Date>(new Date());

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const weekly = await getAssignmentsByWeek(semesterId);

        // Build a quick lookup for week_number -> start_date
        const weekStartByNumber = new Map<number, string>();
        weekly.weeks.forEach((w: WeekBucket) => {
          weekStartByNumber.set(w.week_number, w.start_date);
        });

        const evts: RbcEvent[] = [];
        for (const w of weekly.weeks) {
          for (const a of w.assignments) {
            // Use explicit due_date if present, otherwise place on the week's start
            const dateStr = a.due_date ?? weekStartByNumber.get(a.week_no || w.week_number);
            if (!dateStr) continue;
            const startDate = new Date(dateStr);
            const endDate = new Date(dateStr);
            evts.push({
              title: a.title + (a.course_name ? ` · ${a.course_name}` : ""),
              start: startDate,
              end: endDate,
              allDay: true,
              resource: {
                type: "assignment",
                status: a.status,
                courseName: a.course_name,
                courseColor: a.course_color,
              },
            });
          }
        }

        if (mounted) {
          setEvents(evts);
          // Use current week if available to center the view
          const current = weekly.weeks.find((w) => (w as any).is_current_week);
          if (current) setDefaultDate(new Date(current.start_date));
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load calendar");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (semesterId) load();
    return () => {
      mounted = false;
    };
  }, [semesterId]);

  const eventPropGetter = useMemo(
    () =>
      (event: RbcEvent) => {
        const color = event.resource?.courseColor || "#4A7C2A"; // default brand
        const style = {
          backgroundColor: `${color}22`,
          borderColor: color,
          color: "#2C2A29",
          borderWidth: "1px",
          borderStyle: "solid",
        } as React.CSSProperties;
        return { style };
      },
    []
  );

  if (loading) {
    return (
      <Card p="xl" radius="md" withBorder>
        <Stack align="center" gap="md">
          <Loader />
          <Text c="dimmed">Loading calendar…</Text>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={16} />}>{error}</Alert>
    );
  }

  return (
    <Card p="md" radius="md" withBorder>
      <Stack gap="md">
        <Group>
          <IconCalendar size={20} />
          <Title order={3}>Calendar</Title>
        </Group>
        <div style={{ height: rem(680) }}>
          <Calendar
            localizer={localizer}
            events={events}
            defaultView={"week" as View}
            views={["week", "month"]}
            startAccessor="start"
            endAccessor="end"
            defaultDate={defaultDate}
            popup
            eventPropGetter={eventPropGetter}
            style={{ height: "100%", background: "var(--sanctuary-card)" }}
          />
        </div>
      </Stack>
    </Card>
  );
}
