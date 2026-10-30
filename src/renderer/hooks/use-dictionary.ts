import { useState, useCallback } from 'react';
import type { DictionaryEntry } from '../../shared/types';

export function useDictionary() {
  const [result, setResult] = useState<DictionaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (word: string) => {
    const cleaned = word.trim().replace(/[^a-zA-Z]/g, '');
    if (!cleaned) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Online lookup via Free Dictionary API
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleaned)}`
      );

      if (!response.ok) {
        throw new Error('Definition not found');
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const entry: DictionaryEntry = {
          word: item.word || cleaned,
          phonetic: item.phonetic || item.phonetics?.[0]?.text,
          meanings: (item.meanings || []).map((m: any) => ({
            partOfSpeech: m.partOfSpeech || '',
            definitions: (m.definitions || []).map((d: any) => ({
              definition: d.definition,
              example: d.example,
            })),
          })),
        };
        setResult(entry);
      } else {
        throw new Error('No definition found');
      }
    } catch (err: any) {
      // Fallback: offline mock / basic definition
      setError(err?.message || 'Failed to fetch definition');
      setResult({
        word: cleaned,
        meanings: [
          {
            partOfSpeech: 'definition',
            definitions: [
              {
                definition: `Could not load online definition for "${cleaned}". Check your internet connection.`,
              },
            ],
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isLoading, error, lookup, clear };
}

