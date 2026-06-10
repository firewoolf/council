'use client';

import { create } from 'zustand';

type SheetKind = 'none' | 'memberDrawer' | 'bgPicker';

interface SessionUiState {
  sheet: SheetKind;
  selectedMemberId: string | null;
  openMemberDrawer: (id: string) => void;
  openBgPicker: () => void;
  closeSheet: () => void;
}

export const useSessionUiStore = create<SessionUiState>((set) => ({
  sheet: 'none',
  selectedMemberId: null,
  openMemberDrawer: (id) => set({ sheet: 'memberDrawer', selectedMemberId: id }),
  openBgPicker: () => set({ sheet: 'bgPicker', selectedMemberId: null }),
  closeSheet: () => set({ sheet: 'none', selectedMemberId: null }),
}));
