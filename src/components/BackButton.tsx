'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  href?: string;
  label?: string;
  variant?: 'default' | 'light' | 'hero';
}

export function BackButton({ href, label = 'Volver', variant = 'hero' }: BackButtonProps) {
  const router = useRouter();

  const isHero = variant === 'light' || variant === 'hero';

  const className = isHero
    ? "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-md transition-all shadow-sm border border-white/30 hover:scale-[1.02] active:scale-95 mb-2"
    : "inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary transition-colors";

  const inner = (
    <>
      <svg className="w-4 h-4 text-white stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      {inner}
    </button>
  );
}
