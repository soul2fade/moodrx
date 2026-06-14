import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import Slider from '@react-native-community/slider';
import { MoodIcon } from '@/components/MoodIcon';
import { flattenStyle } from '@/utils/flatten-style';
import { type as t, fonts } from '@/lib/typography';
import { colors } from '@/lib/colors';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import type { MoodKey } from '@/lib/storage';
import { getVentConsent, setVentConsent, getVentEnabled } from '@/lib/storage';
import { fetchVentReply } from '@/lib/vent-client';
import { ventAction, buildVentSession, foldInterim, joinTranscript, pickRecognitionMode, nextRecognitionStep, type VentAssessment } from '@/lib/vent';
import { captureSessionHealth } from '@/lib/health';
import { createSessionId } from '@/lib/session-utils';
import { useSessions } from '@/contexts/SessionsContext';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type VentState = 'consent' | 'invite' | 'recording' | 'thinking' | 'reply' | 'fallback';

interface Correction {
  mood: MoodKey;
  intensity: number;
}

const HARD_STOP_MS = 60_000;        // absolute ceiling (was 30s)
const SILENCE_PROMPT_MS = 12_000;   // continuous silence before the check-in fades in (Task 3)
const SILENCE_AUTOFINISH_MS = 15_000; // further silence after the check-in shows → graceful auto-finish (Task 3)
const NO_VOICE_MESSAGE = "Didn't catch your voice that time — tap it in instead.";

export default function VentScreen() {
  const insets = useSafeAreaInsets();
  const { addSession } = useSessions();
  const { fadeAnim, slideAnim } = useScreenAnimation();

  const [ventState, setVentState] = useState<VentState>('invite');
  const [transcript, setTranscript] = useState('');
  const [assessment, setAssessment] = useState<VentAssessment | null>(null);
  const [corrected, setCorrected] = useState<Correction | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [showResource, setShowResource] = useState(false);
  const [isConsentLoading, setIsConsentLoading] = useState(true);
  const [showSilenceCheckin, setShowSilenceCheckin] = useState(false);
  // Gentle inline fallback message (shown instead of a system Alert when voice
  // can't be used and we route the user to tapping their mood in).
  const [fallbackNote, setFallbackNote] = useState('');

  // Refs for timer IDs so we can clean them up reliably
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silencePromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceAutoFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkinAnim = useRef(new Animated.Value(0)).current;
  // Ref for latest transcript so the 'end' event handler reads the final value
  const transcriptRef = useRef('');
  // Ref for the accumulated, locked-in portion of the transcript (completed
  // phrases). Interim text is folded in as soon as the recognizer resets to a
  // new phrase (see foldInterim) — NOT only on isFinal — so a mid-sentence pause
  // can't drop earlier words.
  const committedTranscriptRef = useRef('');
  // Latest interim of the phrase still in progress (the part not yet locked in).
  const prevInterimRef = useRef('');
  // Ref to track whether we're actively recording (guards cleanup stop call)
  const isRecordingRef = useRef(false);
  // True once the USER (or an auto-finish/hard-stop timer) ends the session, so the
  // next `end` finalizes instead of restarting. A natural `end` (utterance/pause)
  // with this still false means "keep listening" → restart (emulated continuous).
  const userEndedRef = useRef(false);
  // The recognizer mode chosen for this session (on-device vs cloud), reused on
  // every restart so the whole session stays in one mode.
  const modeOnDeviceRef = useRef(true);
  // Double-persist guard: flipped to true the first time persist is called
  const persistedRef = useRef(false);
  // Set on unmount; guards async continuations (e.g. handleSubmit after await)
  // from setting state or persisting a session on a dead screen.
  const unmountedRef = useRef(false);

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  // ─── Consent gate on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await getVentEnabled();
      if (!enabled) {
        router.back();
        return;
      }
      const consent = await getVentConsent();
      if (!cancelled) {
        setVentState(consent ? 'invite' : 'consent');
        setIsConsentLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setVentState('invite');
        setIsConsentLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // ─── Unmount cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
      if (silencePromptTimerRef.current) clearTimeout(silencePromptTimerRef.current);
      if (silenceAutoFinishTimerRef.current) clearTimeout(silenceAutoFinishTimerRef.current);
      if (isRecordingRef.current) {
        try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
      }
    };
  }, []);

  // ─── STT event: result ───────────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    if (!isRecordingRef.current) return; // ignore stray results after recording ended
    const segment = event.results[0]?.transcript ?? '';
    const { committed, prevInterim, display } = foldInterim(
      committedTranscriptRef.current,
      prevInterimRef.current,
      segment,
      event.isFinal,
    );
    committedTranscriptRef.current = committed;
    prevInterimRef.current = prevInterim;
    setTranscript(display);
    transcriptRef.current = display;
    resetSilenceTimer();
  });

  // ─── STT event: end ──────────────────────────────────────────────────────
  // Every utterance ends here (continuous:false). While the user hasn't ended the
  // session, a natural end (end of an utterance / a pause) means "keep listening"
  // → restart recognition, accumulating across utterances. Once they end it, this
  // finalizes. `end` always fires last, even after an error/nomatch (per expo-
  // speech-recognition), so it's the single decision point.
  useSpeechRecognitionEvent('end', () => {
    if (!isRecordingRef.current) return; // already handled (e.g. fallback called)
    const step = nextRecognitionStep({
      userEnded: userEndedRef.current,
      hasTranscript: transcriptRef.current.trim().length > 0,
    });
    if (step === 'restart') {
      beginRecognition(); // keep the hard-stop + silence timers running across restarts
      return;
    }
    isRecordingRef.current = false;
    if (hardStopTimerRef.current) {
      clearTimeout(hardStopTimerRef.current);
      hardStopTimerRef.current = null;
    }
    clearSilenceTimers();
    setShowSilenceCheckin(false);
    if (step === 'submit') void handleSubmit(transcriptRef.current);
    else fallbackToForm(NO_VOICE_MESSAGE);
  });

  // ─── STT event: error ────────────────────────────────────────────────────
  // `end` always fires last — including after an error — so it owns the
  // restart/finalize decision. Here we only tidy the silence check-in.
  useSpeechRecognitionEvent('error', () => {
    if (!isRecordingRef.current) return;
    clearSilenceTimers();
    setShowSilenceCheckin(false);
  });

  // ─── Silence timer management ────────────────────────────────────────────
  const clearSilenceTimers = useCallback(() => {
    if (silencePromptTimerRef.current) {
      clearTimeout(silencePromptTimerRef.current);
      silencePromptTimerRef.current = null;
    }
    if (silenceAutoFinishTimerRef.current) {
      clearTimeout(silenceAutoFinishTimerRef.current);
      silenceAutoFinishTimerRef.current = null;
    }
  }, []);

  // ─── Fallback to form ────────────────────────────────────────────────────
  // Show a calm inline screen (not a system Alert) explaining why voice didn't
  // work, with a way to tap the mood in or retry the mic. Far gentler on a
  // venting screen than an OK popup.
  const fallbackToForm = useCallback((note: string) => {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
    }
    if (hardStopTimerRef.current) {
      clearTimeout(hardStopTimerRef.current);
      hardStopTimerRef.current = null;
    }
    clearSilenceTimers();
    setShowSilenceCheckin(false);
    setFallbackNote(note);
    setVentState('fallback');
  }, [clearSilenceTimers]);

  // Restart the silence countdown. Called on recording start, on every speech
  // result, and on "Keep going". Hides the check-in (unconditionally — cheap
  // no-op if already hidden; kept dependency-free so the STT result handler
  // always invokes a fresh, correct instance) and schedules: (a) show the
  // check-in after SILENCE_PROMPT_MS, then (b) graceful auto-finish after a
  // further SILENCE_AUTOFINISH_MS.
  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimers();
    setShowSilenceCheckin(false);
    checkinAnim.setValue(0);
    silencePromptTimerRef.current = setTimeout(() => {
      if (!isRecordingRef.current) return;
      setShowSilenceCheckin(true);
      Animated.timing(checkinAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      silenceAutoFinishTimerRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          userEndedRef.current = true; // graceful finish — next `end` finalizes, not restarts
          try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
        }
      }, SILENCE_AUTOFINISH_MS);
    }, SILENCE_PROMPT_MS);
  }, [clearSilenceTimers, checkinAnim]);

  // ─── Persist (once) ──────────────────────────────────────────────────────
  const persist = useCallback(async (a: VentAssessment, corr: Correction | null) => {
    if (persistedRef.current) return;
    persistedRef.current = true;
    try {
      const health = await captureSessionHealth();
      await addSession(buildVentSession({
        id: createSessionId(),
        mood: corr?.mood ?? a.mood,
        intensity: corr?.intensity ?? a.intensity,
        timestamp: Date.now(),
        health,
      }));
    } catch {
      // persist failure: non-blocking, don't surface to user
    }
  }, [addSession]);

  // ─── Begin (or restart) a recognition utterance ───────────────────────────
  // One short `continuous:false` utterance — the mode that works on Android's
  // on-device SODA recognizer without the mid-stream-close race. The session's
  // hard-stop + silence timers and the accumulated transcript are owned by
  // handleStartRecording and the result handler, NOT reset here, so restarting
  // after a pause keeps listening and keeps accumulating.
  const beginRecognition = useCallback(() => {
    // Preserve any in-progress interim across a restart (so a phrase that didn't
    // get a final result before the session ended isn't lost), then start fresh.
    if (prevInterimRef.current) {
      committedTranscriptRef.current = joinTranscript(committedTranscriptRef.current, prevInterimRef.current);
      prevInterimRef.current = '';
    }
    isRecordingRef.current = true;
    // Bridge natural pauses (~4s) so the recognizer doesn't end + restart-beep on
    // every short pause. This is only safe because foldInterim locks in each
    // phrase when the recognizer resets its interim mid-session — so even though
    // SODA's single final result for a bridged session only carries the LAST
    // phrase, no pre-pause words are dropped. (Without foldInterim this silently
    // dropped content — a crisis-safety hazard.)
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: modeOnDeviceRef.current,
      addsPunctuation: true,
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 4000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 4000,
      },
    });
  }, []);

  // ─── Tap to start recording ───────────────────────────────────────────────
  const handleStartRecording = async () => {
    if (isRecordingRef.current) return; // re-entry guard: ignore double-taps
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      fallbackToForm("MoodRx needs the mic to hear you — tap it in instead");
      return;
    }
    persistedRef.current = false;
    userEndedRef.current = false;
    setTranscript('');
    transcriptRef.current = '';
    committedTranscriptRef.current = '';
    prevInterimRef.current = '';
    isRecordingRef.current = true;
    setVentState('recording');
    // Prefer on-device STT (audio never leaves the phone); fall back to cloud
    // only if the device can't do on-device recognition for this locale.
    let mode = { requiresOnDeviceRecognition: true, usingCloud: false };
    try {
      const supportsOnDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
      const localesResult = await ExpoSpeechRecognitionModule
        .getSupportedLocales({})
        .catch(() => ({ installedLocales: [] as string[] }));
      const onDeviceLocales = localesResult?.installedLocales ?? [];
      mode = pickRecognitionMode({ supportsOnDevice, onDeviceLocales, locale: 'en-US' });
      if (mode.usingCloud) {
        // Kick off an offline model download so on-device works next time (Android 13+).
        try { ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload?.({ locale: 'en-US' }); } catch { /* iOS / unsupported */ }
      }
    } catch { /* capability probe failed — default to on-device attempt */ }
    modeOnDeviceRef.current = mode.requiresOnDeviceRecognition;
    // Hard auto-stop ceiling for the whole session (survives utterance restarts).
    hardStopTimerRef.current = setTimeout(() => {
      if (isRecordingRef.current) {
        userEndedRef.current = true;
        try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
      }
    }, HARD_STOP_MS);
    resetSilenceTimer();
    beginRecognition();
  };

  // ─── Manual stop (DONE TALKING) ───────────────────────────────────────────
  const handleManualStop = () => {
    userEndedRef.current = true; // user ended → next `end` finalizes, not restarts
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* guard */ }
  };

  // ─── Submit transcript to API ─────────────────────────────────────────────
  const handleSubmit = async (text: string) => {
    setVentState('thinking');
    const a = await fetchVentReply(text);
    if (unmountedRef.current) return; // screen gone — don't persist a phantom session or setState
    if (!a) {
      fallbackToForm("Couldn't reach Dr. MoodRx — tap it in instead");
      return;
    }
    setAssessment(a);
    const action = ventAction(a.risk);
    if (action === 'crisis-redirect') {
      // Persist before redirect with inferred values
      await persist(a, null);
      router.replace('/crisis');
    } else if (action === 'reply-with-resource') {
      setShowResource(true);
      setVentState('reply');
    } else {
      setVentState('reply');
    }
  };

  // ─── Prescription handoff ─────────────────────────────────────────────────
  const handlePrescription = async () => {
    if (!assessment) return;
    await persist(assessment, corrected);
    router.push({
      pathname: '/prescription',
      params: {
        mood: corrected?.mood ?? assessment.mood,
        intensity: String(corrected?.intensity ?? assessment.intensity),
      },
    });
  };

  // ─── I'm good ────────────────────────────────────────────────────────────
  const handleImGood = async () => {
    if (!assessment) return;
    await persist(assessment, corrected);
    router.replace('/home');
  };

  const moodForChip = corrected?.mood ?? assessment?.mood ?? 'anxious';
  const intensityForChip = corrected?.intensity ?? assessment?.intensity ?? 5;
  const accentColor = MOODS[moodForChip].color;

  if (isConsentLoading) {
    return <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]} />;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 56), paddingBottom: Math.max(insets.bottom + 16, 56) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back nav */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backButton}>← BACK</Text>
        </TouchableOpacity>

        {/* ── CONSENT ─────────────────────────────────────────── */}
        {ventState === 'consent' && (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>BEFORE YOU VENT</Text>
            <Text style={styles.headline}>One quick thing.</Text>
            <View style={styles.consentCard}>
              <Text style={styles.consentText}>
                Your voice is turned into text on your phone when it can. If it can&apos;t, it&apos;s sent to Apple/Google to transcribe.{'\n'}
                That text goes to our AI for a reply — nothing is stored or used to train AI.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={async () => {
                await setVentConsent(true);
                setVentState('invite');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>GOT IT — LET&apos;S GO →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── INVITE ──────────────────────────────────────────── */}
        {ventState === 'invite' && (
          <View style={[styles.section, styles.sectionFill]}>
            <Text style={styles.sectionEyebrow}>DR. MOODRX</Text>
            <Text style={styles.headline}>What&apos;s actually going on?</Text>
            <Text style={styles.inviteSubtext}>
              Tap and talk. 20 seconds. Dr. MoodRx is listening.
            </Text>
            <View style={{ flex: 1 }} />
            <View style={styles.micCenterRow}>
              <TouchableOpacity
                onPress={handleStartRecording}
                activeOpacity={0.75}
                style={styles.micButton}
                accessibilityRole="button"
                accessibilityLabel="Start voice venting"
              >
                <View style={styles.micButtonInner}>
                  <Text style={styles.micIcon}>●</Text>
                </View>
                <View style={[styles.micRing, styles.micRing1]} />
                <View style={[styles.micRing, styles.micRing2]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.micHint}>TAP THE MIC</Text>
          </View>
        )}

        {/* ── RECORDING ───────────────────────────────────────── */}
        {ventState === 'recording' && (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>LISTENING</Text>
            <Text style={styles.headline}>I&apos;m all ears.</Text>
            <Text style={styles.recordingHint}>Take your time — tap done when you&apos;re ready</Text>
            {/* Live transcript */}
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText} numberOfLines={6}>
                {transcript.length > 0 ? transcript : '…'}
              </Text>
            </View>
            <View style={styles.pulseDot} />
            {showSilenceCheckin && (
              <Animated.View
                style={[
                  styles.checkinBlock,
                  {
                    opacity: checkinAnim,
                    transform: [{
                      translateY: checkinAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    }],
                  },
                ]}
              >
                <Text style={styles.checkinText}>Still here — take your time.</Text>
                <TouchableOpacity
                  style={styles.checkinBtn}
                  onPress={resetSilenceTimer}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Keep going"
                >
                  <Text style={styles.checkinBtnText}>KEEP GOING</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={handleManualStop}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
            >
              <Text style={styles.stopBtnText}>■  DONE TALKING</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── THINKING ────────────────────────────────────────── */}
        {ventState === 'thinking' && (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>DR. MOODRX</Text>
            <Text style={styles.headline}>Let me hear you out…</Text>
            <View style={styles.thinkingBox}>
              <Text style={styles.thinkingText}>
                Sitting with what you said.
              </Text>
            </View>
          </View>
        )}

        {/* ── FALLBACK (voice unavailable — gentle inline, no system Alert) ── */}
        {ventState === 'fallback' && (
          <View style={[styles.section, styles.sectionFill]}>
            <Text style={styles.sectionEyebrow}>NO WORRIES</Text>
            <Text style={styles.headline}>Let&apos;s tap it in.</Text>
            <View style={styles.consentCard}>
              <Text style={styles.consentText}>{fallbackNote}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace('/home')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Tap your mood in instead"
            >
              <Text style={styles.primaryBtnText}>TAP IT IN →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleStartRecording}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Try the mic again"
            >
              <Text style={styles.secondaryBtnText}>TRY THE MIC AGAIN</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── REPLY ───────────────────────────────────────────── */}
        {ventState === 'reply' && assessment && (
          <View style={[styles.section, styles.sectionFill]}>
            <Text style={styles.sectionEyebrow}>DR. MOODRX SAYS</Text>

            {/* The reply line — prominent */}
            <View style={[styles.replyCard, { borderLeftColor: accentColor }]}>
              <Text style={styles.replyText}>{assessment.reply}</Text>
            </View>

            {/* Tappable mood chip */}
            <TouchableOpacity
              onPress={() => setShowCorrection((v) => !v)}
              activeOpacity={0.8}
              style={[styles.moodChip, { borderColor: accentColor }]}
              accessibilityRole="button"
              accessibilityLabel={`Sounds like ${MOODS[moodForChip].name} at intensity ${intensityForChip} out of 10. Tap to correct.`}
            >
              <MoodIcon mood={moodForChip} size={16} color={accentColor} opacity={1} />
              <Text style={[styles.moodChipText, { color: accentColor }]}>
                Sounds like: {MOODS[moodForChip].name} · {intensityForChip}/10
              </Text>
              <Text style={[styles.moodChipCaret, { color: accentColor }]}>
                {showCorrection ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {/* Correction control */}
            {showCorrection && (
              <View style={styles.correctionPanel}>
                <Text style={styles.correctionLabel}>CORRECT THE MOOD</Text>
                <View style={styles.moodRow}>
                  {MOOD_ORDER.map((moodKey) => {
                    const selected = moodForChip === moodKey;
                    return (
                      <TouchableOpacity
                        key={moodKey}
                        onPress={() => setCorrected({ mood: moodKey, intensity: intensityForChip })}
                        style={selected
                          ? flattenStyle([styles.moodChipSmall, { borderColor: MOODS[moodKey].color }])
                          : styles.moodChipSmall}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <MoodIcon mood={moodKey} size={18} color={MOODS[moodKey].color} opacity={selected ? 1 : 0.5} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.correctionLabel}>INTENSITY {intensityForChip}/10</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={intensityForChip}
                  onValueChange={(v) => setCorrected({ mood: moodForChip, intensity: v })}
                  minimumTrackTintColor={accentColor}
                  maximumTrackTintColor="#1a1a1a"
                  thumbTintColor={accentColor}
                  accessibilityLabel={`Intensity: ${intensityForChip} out of 10`}
                  accessibilityRole="adjustable"
                />
              </View>
            )}

            {/* Elevated resource link */}
            {showResource && (
              <TouchableOpacity
                onPress={() => router.push('/crisis')}
                activeOpacity={0.7}
                style={styles.resourceLink}
                accessibilityRole="button"
                accessibilityLabel="Want to talk to someone? Crisis resources"
              >
                <Text style={styles.resourceLinkText}>Want to talk to someone? →</Text>
                <TouchableOpacity
                  onPress={() => setShowResource(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss resource link"
                >
                  <Text style={styles.resourceLinkDismiss}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />

            {/* Actions */}
            <TouchableOpacity
              style={[styles.primaryBtn, { borderColor: accentColor }]}
              onPress={handlePrescription}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Get my prescription"
            >
              <Text style={[styles.primaryBtnText, { color: accentColor }]}>
                GET MY PRESCRIPTION →
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleImGood}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="I'm good"
            >
              <Text style={styles.secondaryBtnText}>I&apos;M GOOD</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Always-available crisis path — independent of what the model detects, so
          a missed/garbled transcript can never mean a missed crisis. */}
      {ventState !== 'consent' && (
        <TouchableOpacity
          style={[styles.crisisFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onPress={() => router.push('/crisis')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="In crisis? Get help now"
        >
          <Text style={styles.crisisFooterText}>In crisis? Get help now →</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  crisisFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  crisisFooterText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#7EC8A0',
    letterSpacing: 1,
    lineHeight: 18,
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 56,
    flexGrow: 1,
  },
  backButton: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 28,
  },
  sectionFill: {
    flexGrow: 1,
  },
  sectionEyebrow: {
    ...t.label,
    color: colors.accent,
    letterSpacing: 3,
    marginBottom: 8,
  },
  headline: {
    ...t.headline,
    fontSize: 28,
    marginBottom: 12,
  },

  // ── Consent ─────────────────────────────────────────────────────────────
  consentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    marginTop: 4,
    marginBottom: 28,
  },
  consentText: {
    ...t.body,
    fontSize: 16,
    lineHeight: 25,
    color: colors.textMuted,
  },

  // ── Invite ───────────────────────────────────────────────────────────────
  inviteSubtext: {
    ...t.bodyMuted,
    fontSize: 16,
    marginBottom: 40,
    lineHeight: 24,
  },
  micCenterRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  micButton: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    fontSize: 28,
    // eslint-disable-next-line local/no-dark-text-color
    color: '#0a0a0a',
    lineHeight: 32,
  },
  micRing: {
    position: 'absolute',
    borderRadius: 48,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  micRing1: {
    width: 84,
    height: 84,
    opacity: 0.3,
  },
  micRing2: {
    width: 96,
    height: 96,
    opacity: 0.12,
  },
  micHint: {
    ...t.label,
    textAlign: 'center',
    color: colors.textSubtle,
    letterSpacing: 3,
    marginTop: 4,
  },

  // ── Recording ────────────────────────────────────────────────────────────
  recordingHint: {
    ...t.bodySm,
    color: colors.textSubtle,
    marginBottom: 20,
  },
  transcriptBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    minHeight: 100,
    marginBottom: 20,
  },
  transcriptText: {
    ...t.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    alignSelf: 'center',
    marginBottom: 20,
  },
  stopBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopBtnText: {
    ...t.button,
    color: colors.danger,
    letterSpacing: 2,
  },
  checkinBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  checkinText: {
    ...t.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  checkinBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  checkinBtnText: {
    ...t.label,
    color: colors.accent,
    letterSpacing: 2,
  },

  // ── Thinking ─────────────────────────────────────────────────────────────
  thinkingBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  thinkingText: {
    ...t.bodyMuted,
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.textMuted,
  },

  // ── Reply ─────────────────────────────────────────────────────────────────
  replyCard: {
    borderLeftWidth: 3,
    backgroundColor: colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  replyText: {
    ...t.body,
    fontSize: 17,
    lineHeight: 27,
    color: colors.text,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  moodChipText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    letterSpacing: 1,
    flex: 1,
    textTransform: 'uppercase',
    lineHeight: 18,
  },
  moodChipCaret: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
  },

  // ── Correction panel ──────────────────────────────────────────────────────
  correctionPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    marginBottom: 16,
  },
  correctionLabel: {
    ...t.label,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 10,
    fontSize: 16,
    lineHeight: 17,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  moodChipSmall: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  slider: {
    width: '100%',
    height: 36,
    marginTop: 4,
  },

  // ── Resource link (elevated) ───────────────────────────────────────────────
  resourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.surfaceDark,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  resourceLinkText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#7EC8A0',
    letterSpacing: 1,
    lineHeight: 18,
  },
  resourceLinkDismiss: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: colors.textSubtle,
    letterSpacing: 1,
    lineHeight: 18,
  },

  // ── Shared buttons ────────────────────────────────────────────────────────
  primaryBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    ...t.button,
    color: colors.accent,
    letterSpacing: 2,
  },
  secondaryBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryBtnText: {
    ...t.label,
    color: colors.textSubtle,
    letterSpacing: 2,
    fontSize: 16,
    lineHeight: 18,
  },
});
