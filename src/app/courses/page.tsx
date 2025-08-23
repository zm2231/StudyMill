'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CoursesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to course management page
    router.replace('/courses/manage');
  }, [router]);

  return null;
}