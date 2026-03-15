/**
 * Utilitário para merge de classNames (clsx + tailwind-merge)
 * Versão standalone sem dependências externas
 */

export type ClassValue = string | number | boolean | undefined | null | ClassArray | ClassDictionary;

interface ClassDictionary {
  [id: string]: any;
}

interface ClassArray extends Array<ClassValue> {}

/**
 * Combina classNames de forma inteligente
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) {
      continue;
    }

    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      const flattened = cn(...input);
      if (flattened) {
        classes.push(flattened);
      }
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) {
          classes.push(key);
        }
      }
    }
  }

  return classes.join(' ');
}
