const rtlLanguages = new Set(['ar', 'fa', 'he', 'ur']);

export function getDirectionFromLocale(locale: string | undefined): 'ltr' | 'rtl' {
  const language = locale?.split('-')[0]?.toLowerCase();

  return language && rtlLanguages.has(language) ? 'rtl' : 'ltr';
}
