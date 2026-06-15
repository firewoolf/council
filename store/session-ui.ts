'use client';

import { create } from 'zustand';

type SheetKind = 'none' | 'memberDrawer' | 'bgPicker' | 'steeringSheet' | 'pinBoard';

interface SessionUiState {
  sheet: SheetKind;
  selectedMemberId: string | null;
  openMemberDrawer: (id: string) => void;
  openBgPicker: () => void;
  openSteeringSheet: () => void;
  openPinBoard: () => void;
  closeSheet: () => void;
}

export const useSessionUiStore = create<SessionUiState>((set) => ({
  sheet: 'none',
  selectedMemberId: null,
  openMemberDrawer: (id) => set({ sheet: 'memberDrawer', selectedMemberId: id }),
  openBgPicker: () => set({ sheet: 'bgPicker', selectedMemberId: null }),
  openSteeringSheet: () =>
    set({ sheet: 'steeringSheet', selectedMemberId: null }),
  openPinBoard: () => set({ sheet: 'pinBoard', selectedMemberId: null }),
  closeSheet: () => set({ sheet: 'none', selectedMemberId: null }),
}));
