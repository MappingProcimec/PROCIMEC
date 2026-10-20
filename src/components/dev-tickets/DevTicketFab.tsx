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
          className="fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-40 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#1E2229]/90 border border-[#2A303C] hover:border-[#EAA023] text-[#EAA023] shadow-lg opacity-40 hover:opacity-100 hover:scale-105 active:scale-95 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-[#EAA023] focus:ring-offset-2 focus:ring-offset-[#15181D]"
          title="Proponer ticket técnico / idea (DevOps Autónomo)"
          aria-label="Proponer ticket técnico"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#EAA023] rounded-full opacity-60 group-hover:animate-ping" />
            <Lightbulb className="w-5 h-5 text-[#EAA023] group-hover:rotate-12 transition-transform duration-300" strokeWidth={1.75} />
          </div>
        </button>
      </aside>

      <DevTicketModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
