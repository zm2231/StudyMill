import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'StudyMill — AI-Powered Study Platform',
  description: 'Upload PDFs and DOCX, chat with your notes, organize by courses, and plan your semester with AI-powered search and study tools.',
  keywords: ['study platform', 'ai study', 'semantic search', 'pdf to notes', 'course organizer', 'study planner', 'students', 'university', 'uga'],
  openGraph: {
    title: 'StudyMill — AI-Powered Study Platform',
    description: 'Upload PDFs and DOCX, chat with your notes, organize by courses, and plan your semester with AI-powered search and study tools.',
    url: 'https://studymill.ai',
    siteName: 'StudyMill',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StudyMill — AI-Powered Study Platform',
    description: 'Upload PDFs and DOCX, chat with your notes, organize by courses, and plan your semester with AI-powered search and study tools.'
  }
};

export default function HomePage() {
  return <HomeClient />;
}
