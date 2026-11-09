'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrandingTheme } from '@/types';

const defaultBrandingTheme: BrandingTheme = {
  primaryGreen: '#4f8c4c',
  deepGreen: '#3a7536',
  accentGreen: '#2ea033',
  darkNeutral: '#0f172a',
  surfaceColor: '#ffffff',
  lightSurfaceColor: '#ffffff',
  secondarySurface: '#e2efe1',
  fontFamily: 'Inter',
  borderRadius: 'md',
  layoutDensity: 'comfortable',
  buttonStyle: 'rounded',
  cardStyle: 'bordered',
  logoUrl: '/logo.png',
  faviconUrl: '/logo-round.png',
};

interface ThemeContextType {
  theme: BrandingTheme;
  updateTheme: (newTheme: Partial<BrandingTheme>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultBrandingTheme,
  updateTheme: () => {},
  resetTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<BrandingTheme>(defaultBrandingTheme);

  useEffect(() => {
    // Fetch persisted branding theme from Superadmin config on load
    fetch('/api/admin/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.brandingTheme) {
          setTheme(data.data.brandingTheme);
        }
      })
      .catch(() => {
        // Fallback to default Zealosh branding
      });
  }, []);

  useEffect(() => {
    // Inject dynamic CSS custom properties onto root
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--brand-primary', theme.primaryGreen || '#4f8c4c');
      root.style.setProperty('--brand-dark', theme.deepGreen || '#3a7536');
      root.style.setProperty('--brand-accent', theme.accentGreen || '#2ea033');
      root.style.setProperty('--navy-header', theme.darkNeutral || '#0f172a');
      root.style.setProperty('--bg-surface', theme.surfaceColor || '#ffffff');
      root.style.setProperty('--bg-page', theme.lightSurfaceColor || '#f4f9f3');
      root.style.setProperty('--border-color', theme.secondarySurface || '#e2efe1');
    }
  }, [theme]);

  const updateTheme = (newTheme: Partial<BrandingTheme>) => {
    setTheme((prev) => ({ ...prev, ...newTheme }));
  };

  const resetTheme = () => {
    setTheme(defaultBrandingTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
