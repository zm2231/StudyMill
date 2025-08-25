import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'StudyMill for UGA — CRN Course Import, AI Study Tools, Planner',
  description: 'Import UGA courses by CRN, auto-apply the academic calendar, upload PDFs and DOCX, and study with AI chat, semantic search, and a built-in planner.',
  keywords: ['uga', 'university of georgia', 'uga crn', 'course importer', 'academic calendar', 'study planner', 'ai study', 'pdf to notes', 'semantic search'],
  openGraph: {
    title: 'StudyMill for UGA — CRN Course Import, AI Study Tools, Planner',
    description: 'Import UGA courses by CRN, auto-apply the academic calendar, upload PDFs and DOCX, and study with AI chat, semantic search, and a built-in planner.',
    url: 'https://studymill.ai',
    siteName: 'StudyMill',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StudyMill for UGA — CRN Course Import, AI Study Tools, Planner',
    description: 'Import UGA courses by CRN, auto-apply the academic calendar, upload PDFs and DOCX, and study with AI chat, semantic search, and a built-in planner.'
  }
};

export default function HomePage() {
  return <HomeClient />;
}
