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

  // Save preference to localStorage and optionally Firebase
  const savePreference = async (dark: boolean) => {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    if (user?.id) {
      await set(ref(database, `users/${user.id}/settings/theme`), dark ? 'dark' : 'light');
    }
  };

  // Load preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      let dark = false;
      // 1. Check Firebase if user is logged in
      if (user?.id) {
        const snapshot = await get(ref(database, `users/${user.id}/settings/theme`));
        const firebaseTheme = snapshot.val();
        if (firebaseTheme) {
          dark = firebaseTheme === 'dark';
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem('theme');
          dark = stored === 'dark';
        }
      } else {
        const stored = localStorage.getItem('theme');
        dark = stored === 'dark';
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