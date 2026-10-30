import { useState, useEffect, useCallback, useRef } from 'react';

export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  const cleaned = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const matches = cleaned.match(/[^.!?]+(?:[.!?]+(?=\s+|$)|$)/g);
  if (!matches) return [cleaned];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function useTTS() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Karaoke & sentence queue state
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [currentWordCharIndex, setCurrentWordCharIndex] = useState<number>(0);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const sentenceIndexRef = useRef<number>(0);
  const sentencesRef = useRef<string[]>([]);
  const rateRef = useRef<number>(rate);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(currentVoice);

  rateRef.current = rate;
  voiceRef.current = currentVoice;
  sentenceIndexRef.current = currentSentenceIndex;
  sentencesRef.current = sentences;

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;

      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        setVoices(available);
        if (available.length > 0 && !currentVoice) {
          // Prefer an English or natural sounding voice by default
          const natural = available.find((v) => v.name.includes('Natural') || v.name.includes('Neural'));
          const defaultVoice = natural || available.find((v) => v.default) || available[0];
          setCurrentVoice(defaultVoice);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const playSentenceAtIndex = useCallback((index: number) => {
    const list = sentencesRef.current;
    if (!synthRef.current || index < 0 || index >= list.length) {
      setIsSpeaking(false);
      setIsPaused(false);
      isPlayingRef.current = false;
      return;
    }

    synthRef.current.cancel();

    const sentenceText = list[index];
    setCurrentSentenceIndex(index);
    setCurrentWordCharIndex(0);

    const utterance = new SpeechSynthesisUtterance(sentenceText);
    utteranceRef.current = utterance;

    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.rate = rateRef.current;
    utterance.pitch = pitch;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      isPlayingRef.current = true;
    };

    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        setCurrentWordCharIndex(e.charIndex);
      }
    };

    utterance.onend = () => {
      if (!isPlayingRef.current) return;
      const nextIdx = index + 1;
      if (nextIdx < sentencesRef.current.length) {
        playSentenceAtIndex(nextIdx);
      } else {
        setIsSpeaking(false);
        setIsPaused(false);
        isPlayingRef.current = false;
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Speech synthesis error:', e);
      }
      setIsSpeaking(false);
      setIsPaused(false);
      isPlayingRef.current = false;
    };

    synthRef.current.speak(utterance);
  }, [pitch]);

  const startPlayback = useCallback(
    (textOrList: string | string[], startIndex = 0) => {
      const list = Array.isArray(textOrList)
        ? textOrList
        : splitIntoSentences(textOrList);

      if (list.length === 0) return;

      setSentences(list);
      sentencesRef.current = list;
      isPlayingRef.current = true;
      playSentenceAtIndex(startIndex);
    },
    [playSentenceAtIndex]
  );

  const pause = useCallback(() => {
    if (synthRef.current && isSpeaking) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentenceIndex(0);
    setCurrentWordCharIndex(0);
  }, []);

  const nextSentence = useCallback(() => {
    const nextIdx = sentenceIndexRef.current + 1;
    if (nextIdx < sentencesRef.current.length) {
      playSentenceAtIndex(nextIdx);
    } else {
      stop();
    }
  }, [playSentenceAtIndex, stop]);

  const prevSentence = useCallback(() => {
    const prevIdx = Math.max(0, sentenceIndexRef.current - 1);
    playSentenceAtIndex(prevIdx);
  }, [playSentenceAtIndex]);

  const seekSentence = useCallback(
    (index: number) => {
      playSentenceAtIndex(index);
    },
    [playSentenceAtIndex]
  );

  const changeRate = useCallback((newRate: number) => {
    setRate(newRate);
    rateRef.current = newRate;
    // If speaking, replay current sentence with new rate
    if (isPlayingRef.current && synthRef.current?.speaking) {
      playSentenceAtIndex(sentenceIndexRef.current);
    }
  }, [playSentenceAtIndex]);

  const changeVoice = useCallback((voice: SpeechSynthesisVoice | null) => {
    setCurrentVoice(voice);
    voiceRef.current = voice;
    if (isPlayingRef.current && synthRef.current?.speaking) {
      playSentenceAtIndex(sentenceIndexRef.current);
    }
  }, [playSentenceAtIndex]);

  return {
    isSpeaking,
    isPaused,
    voices,
    currentVoice,
    rate,
    pitch,
    sentences,
    currentSentenceIndex,
    currentSentence: sentences[currentSentenceIndex] || '',
    currentWordCharIndex,
    startPlayback,
    pause,
    resume,
    stop,
    nextSentence,
    prevSentence,
    seekSentence,
    setVoice: changeVoice,
    setRate: changeRate,
    setPitch,
  };
}
