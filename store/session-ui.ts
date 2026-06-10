'use client';

import { create } from 'zustand';

type SheetKind = 'none' | 'memberDrawer' | 'bgPicker' | 'steeringSheet';

interface SessionUiState {
  sheet: SheetKind;
  selectedMemberId: string | null;
  openMemberDrawer: (id: string) => void;
  openBgPicker: () => void;
  openSteeringSheet: () => void;
  closeSheet: () => void;
}

export const useSessionUiStore = create<SessionUiState>((set) => ({
  sheet: 'none',
  selectedMemberId: null,
  openMemberDrawer: (id) => set({ sheet: 'memberDrawer', selectedMemberId: id }),
  openBgPicker: () => set({ sheet: 'bgPicker', selectedMemberId: null }),
  openSteeringSheet: () =>
    set({ sheet: 'steeringSheet', selectedMemberId: null }),
  closeSheet: () => set({ sheet: 'none', selectedMemberId: null }),
}));
