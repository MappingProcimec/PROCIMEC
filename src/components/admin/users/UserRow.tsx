'use client';

import React from 'react';
import Link from 'next/link';
import {
  Settings,
  ChevronDown,
  UserCog,
  Clock,
  UserX,
  UserCheck,
} from 'lucide-react';
import { User, RoleOption } from './types';
import { userDisplayBadge } from './user-helpers';

export interface UserRowProps {
  user: User;
  roleOptions: RoleOption[];
  rolesById?: Map<string, RoleOption>;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onConfirmDeactivate: () => void;
  isActionPending?: boolean;
}

export function UserRow({
  user,
  roleOptions,
  rolesById,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onToggleActive,
  onConfirmDeactivate,
  isActionPending = false,
}: UserRowProps) {
  const badge = userDisplayBadge(user, roleOptions, rolesById);

  return (
    <div
      className={`p-4 sm:p-5 flex items-center gap-4 transition-colors ${
        user.role === 'pending'
          ? 'bg-amber-50/60'
          : !user.is_active
          ? 'bg-gray-50 opacity-60'
          : 'hover:bg-gray-50'
      }`}
    >
      {/* Avatar */}
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar_url}
          alt={user.full_name}
          className="w-11 h-11 rounded-full flex-shrink-0 object-cover border border-border"
        />
      ) : (
        <div className="w-11 h-11 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold">
            {(user.full_name || 'U').charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="font-semibold text-text-primary text-sm">{user.full_name}</p>
          <span className={`badge ${badge.badge} text-xs`}>{badge.label}</span>
          {!user.is_active && <span className="badge badge-gray text-xs">Inactivo</span>}
          {user.role === 'pending' && (
            <span className="badge bg-accent text-primary-900 text-xs animate-pulse-soft flex items-center gap-1 font-bold">
              <Clock className="w-3 h-3 text-primary-900" strokeWidth={2} /> Pendiente
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap font-mono">
          <span>{user.email}</span>
          {user.phone && (
            <>
              <span className="text-gray-300">•</span>
              <span>{user.phone}</span>
            </>
          )}
        </div>
      </div>

      {/* Menu Acciones */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative inline-block text-left">
          <button
            type="button"
            onClick={onToggleMenu}
            className="btn-sm btn-outline text-xs px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-gray-100 rounded-lg font-medium text-text-primary active:scale-[0.98] transition-transform duration-150"
          >
            <Settings className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.75} />
            <span>Acciones</span>
            <ChevronDown className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20 cursor-default"
                onClick={onCloseMenu}
              />
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-border py-1.5 z-30 animate-slide-up origin-top-right">
                <button
                  type="button"
                  onClick={() => {
                    onCloseMenu();
                    onEdit();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors"
                >
                  <UserCog className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.75} />
                  <span>Editar usuario y roles</span>
                </button>

                {user.role !== 'pending' && (
                  <Link
                    href={`/tools/attendance-tracker?userId=${user.id}`}
                    onClick={onCloseMenu}
                    className="w-full text-left px-3.5 py-2 text-xs text-text-primary hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors"
                    title="Ver registro de asistencia de este colaborador"
                  >
                    <Clock className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.75} />
                    <span>Ver asistencia</span>
                  </Link>
                )}

                <div className="border-t border-gray-100 my-1" />

                {user.is_active ? (
                  <button
                    type="button"
                    onClick={() => {
                      onCloseMenu();
                      onConfirmDeactivate();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 font-semibold transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5 text-amber-700" strokeWidth={1.75} />
                    <span>Desactivar usuario</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onCloseMenu();
                      onToggleActive();
                    }}
                    disabled={isActionPending}
                    className="w-full text-left px-3.5 py-2 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 font-semibold transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.75} />
                    <span>Activar usuario</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
