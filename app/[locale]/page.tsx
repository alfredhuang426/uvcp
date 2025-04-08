import React from 'react';
import VideoCompressor from '@/components/VideoCompressor';
import { setRequestLocale } from 'next-intl/server';

export default function Home({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <VideoCompressor />
    </main>
  );
} 