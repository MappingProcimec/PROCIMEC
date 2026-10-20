'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Lightbulb } from 'lucide-react';
import { DevTicketModal } from './DevTicketModal';

export function DevTicketFab() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  // Disponible para colaboradores autenticados (Ley 3 y Ley 4)
  if (status !== 'authenticated' || !session) {
    return null;
  }

  return (
    <>
      <aside aria-label="Buzón de Ideas y Tickets de Desarrollo">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-40 flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-[#1E2229] border-2 border-[#EAA023] text-white shadow-2xl hover:scale-105 active:scale-95 transition-all group focus:outline-none focus:ring-2 focus:ring-[#EAA023] focus:ring-offset-2 focus:ring-offset-[#15181D]"
          title="Proponer ticket técnico / idea (DevOps Autónomo)"
          aria-label="Proponer ticket técnico"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#EAA023] rounded-full animate-ping opacity-75" />
            <Lightbulb className="w-5 h-5 text-[#EAA023] group-hover:rotate-12 transition-transform duration-300" strokeWidth={2} />
          </div>
          <span className="text-xs sm:text-sm font-bold tracking-tight text-white hidden md:inline">
            Ideas
          </span>
        </button>
      </aside>

      <DevTicketModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
