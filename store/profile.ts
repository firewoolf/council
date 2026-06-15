'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface UserProfile {
  observedPatterns: string[];
  updatedAt: string;
}

interface ProfileState extends UserProfile {
  setObservedPatterns: (patterns: string[]) => UserProfile;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      observedPatterns: [],
      updatedAt: '',
      setObservedPatterns: (patterns) => {
        const profile = {
          observedPatterns: patterns
            .map((pattern) => pattern.trim())
            .filter(Boolean)
            .slice(0, 3),
          updatedAt: new Date().toISOString(),
        };
        set(profile);
        return profile;
      },
    }),
    {
      name: 'council:profile',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ observedPatterns, updatedAt }) => ({
        observedPatterns,
        updatedAt,
      }),
    },
  ),
);
