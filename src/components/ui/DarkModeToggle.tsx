import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './button';
import { useAuth } from '../../hooks/useAuth';
import { ref, set, get } from 'firebase/database';
import { database } from '../../firebase';

export const DarkModeToggle = () => {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Apply theme to document
  const applyTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Save preference to Firebase (only if user is logged in)
  const savePreference = async (dark: boolean) => {
    if (user?.id) {
      try {
        await set(ref(database, `users/${user.id}/settings/theme`), dark ? 'dark' : 'light');
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
  };

  // Load preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      let dark = false;

      if (user?.id) {
        // Check Firebase first
        try {
          const snapshot = await get(ref(database, `users/${user.id}/settings/theme`));
          const firebaseTheme = snapshot.val();
          if (firebaseTheme === 'dark' || firebaseTheme === 'light') {
            dark = firebaseTheme === 'dark';
          } else {
            // No saved preference – use system preference
            dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          }
        } catch (error) {
          console.error('Failed to load theme from Firebase:', error);
          dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
      } else {
        // Not logged in – use system preference
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      setIsDark(dark);
      applyTheme(dark);
      setLoaded(true);
    };

    loadTheme();
  }, [user]);

  const toggle = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    applyTheme(newDark);
    savePreference(newDark);
  };

  if (!loaded) return null; // prevent flash of wrong theme

  return (
    <Button variant="ghost" size="icon" onClick={toggle}>
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
};