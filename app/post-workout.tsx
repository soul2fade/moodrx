import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import type { MoodKey } from '@/lib/storage';
import { addSession, getNotifPromptShown, getPersonalBest, getSessions, getStreak, getUserProfile, savePersonalBest, setUserProfile, UserProfile, PersonalBest, Session } from '@/lib/storage';
import { rescheduleAfterSession } from '@/lib/notifications';
import { MOODS } from '@/lib/moods';
import { getWorkoutById } from '@/lib/workouts';
import { type as t, fonts } from '../lib/typography';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { BreakthroughCard } from '@/components/BreakthroughCard';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useButtonAnimation } from '@/hooks/useButtonAnimation';
import { getInsult } from '@/utils/insults';

function getScoreContext(score: number, lowerIsBetter: boolean): string {
  if (lowerIsBetter) {
    if (score <= 3) return 'Nearly clear.';
    if (score <= 5) return 'Getting there.';
    if (score <= 7) return 'Still some left. Keep going.';
    return 'Rough one. You still showed up.';
  }
  if (score <= 3) return 'Rough. But you moved.';
  if (score <= 5) return 'Improvement.';
  if (score <= 7) return 'Getting there.';
  return "That's what I'm talking about.";
}

export default function PostWorkoutScreen() {
  const params = useLocalSearchParams<{ mood: string; workoutId: string; intensity: string; reps: string }>();
  const mood = (params.mood as MoodKey) in MOODS
    ? (params.mood as MoodKey)
    : (Object.keys(MOODS)[0] as MoodKey);
  const workoutId = params.workoutId || '';
  const intensity = parseInt(params.intensity || '5', 10);
  const sessionReps = parseInt(params.reps || '0', 10);

  const [postScore, setPostScore] = useState(5);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [userProfile, setUserProfileState] = useState<UserProfile>({});
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [previousBest, setPreviousBest] = useState<PersonalBest | null>(null);
  const [note, setNote] = useState('');
  const workout = getWorkoutById(workoutId);

  useEffect(() => {
    Promise.all([getSessions(), getUserProfile(), getPersonalBest(workoutId)]).then(([sessions, profile, pb]) => {
      // sessionCount is pre-save: 0 = completing session 1, 2 = completing session 3
      setSessionCount(sessions.length);
      setStreak(getStreak(sessions));
      setUserProfileState(profile);
      setProfileLoaded(true);
      setPreviousBest(pb);
      if (sessionReps > 0) {
        const isNewBest = pb === null || sessionReps > pb.reps;
        if (isNewBest) savePersonalBest(workoutId, sessionReps);
      }
    });
  }, []);
  const moodData = MOODS[mood];
  const accentColor = moodData.color;
  const lowerIsBetter = mood !== 'good';
  const postInsult = useRef(getInsult(mood, 'post')).current;
  const breakthroughRef = useRef<ViewShot>(null);

  const { buttonScale, onPressIn, onPressOut } = useButtonAnimation();
  const { fadeAnim, slideAnim } = useScreenAnimation();

  const handleShare = async () => {
    if (isSharing || Platform.OS === 'web') return;
    try {
      setIsSharing(true);
      const uri = await (breakthroughRef.current as any)?.capture?.();
      if (uri && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your result' });
      }
    } catch {
      // ignore
    } finally {
      setIsSharing(false);
      setShowCardPreview(false);
    }
  };

  const handleOpenCardPreview = () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCardPreview(true);
  };

  // Prevent Android back button from going back to workout mid-flow
  const backHandler = useCallback(() => {
    router.replace('/home');
    return true;
  }, []);
  useHardwareBack(backHandler);

  const handleLog = async () => {
    if (isSubmitting) return; // prevent double-tap
    setIsSubmitting(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addSession({
        id: Date.now().toString(),
        mood,
        intensity,
        postScore,
        workoutName: workout?.name ?? workoutId,
        workoutId: workoutId || undefined,
        duration: workout?.duration ?? 0,
        timestamp: Date.now(),
        note: note.trim() || undefined,
      });
      getSessions().then((updated) => rescheduleAfterSession(getStreak(updated))).catch(() => {});
      const promptShown = await getNotifPromptShown();
      if (!promptShown) {
        setShowNotifPrompt(true);
      } else {
        router.replace('/home');
      }
    } catch {
      setIsSubmitting(false);
      Alert.alert('Save failed', 'Your session could not be saved. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>You absolute legend.</Text>
        <Text style={styles.subtext}>
          You showed up when your brain said don&apos;t. That takes guts.
        </Text>
        {postInsult !== '' && (
          <Text style={styles.insultLine}>{postInsult}</Text>
        )}

        {sessionReps > 0 && (
          <View style={styles.pbRow}>
            <Text style={styles.pbLabel}>REPS THIS SESSION</Text>
            <Text style={[styles.pbReps, { color: accentColor }]}>{sessionReps}</Text>
            {previousBest !== null && sessionReps > previousBest.reps && (
              <Text style={styles.pbNewBest}>NEW PERSONAL BEST</Text>
            )}
            {previousBest !== null && sessionReps <= previousBest.reps && (
              <Text style={styles.pbPrev}>prev best  {previousBest.reps}</Text>
            )}
          </View>
        )}

        <View style={styles.sectionDivider} />

        <View style={styles.scoreSection}>
          <Text style={styles.howLabel}>{moodData.name.toUpperCase()} LEVEL NOW?</Text>

          <View style={styles.scoreDisplay}>
            <Text style={[styles.scoreNumber, { color: accentColor }]}>{postScore}</Text>
            <Text style={styles.scoreDenom}>/10</Text>
          </View>

          <Text style={styles.scoreContext}>{getScoreContext(postScore, lowerIsBetter)}</Text>

          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={postScore}
            onValueChange={setPostScore}
            minimumTrackTintColor={accentColor}
            maximumTrackTintColor="#1a1a1a"
            thumbTintColor={accentColor}
            accessibilityLabel={`Post-workout feeling: ${postScore} out of 10`}
            accessibilityRole="adjustable"
          />

          {/* CHANGE — hero number */}
          {(() => {
            const raw = postScore - intensity;
            const displayed = lowerIsBetter ? -raw : raw;
            const isPositive = displayed > 0;
            const isNegative = displayed < 0;
            const changeColor = isPositive ? '#059669' : isNegative ? '#E11D48' : '#555555';
            const changeSub = isPositive
              ? 'Moving in the right direction.'
              : isNegative
              ? 'Rough session. Still counts.'
              : 'Held steady.';
            return (
              <View style={[styles.changeHero, { borderTopColor: changeColor }]}>
                <Text style={styles.changeHeroLabel}>CHANGE</Text>
                <Text style={[styles.changeHeroValue, { color: changeColor }]}>
                  {displayed > 0 ? `+${displayed}` : `${displayed}`}
                </Text>
                <Text style={styles.changeHeroSub}>{changeSub}</Text>
              </View>
            );
          })()}

          {/* Before → Now reference */}
          <View style={styles.deltaRow}>
            <View style={styles.deltaBlock}>
              <Text style={styles.deltaBlockLabel}>BEFORE</Text>
              <Text style={styles.deltaBlockValue}>{intensity}</Text>
            </View>
            <Text style={styles.deltaArrow}>→</Text>
            <View style={styles.deltaBlock}>
              <Text style={styles.deltaBlockLabel}>NOW</Text>
              <Text style={[styles.deltaBlockValue, { color: accentColor }]}>{postScore}</Text>
            </View>
          </View>
        </View>

        {workout && (
          <View style={styles.workoutInfo}>
            <Text style={styles.completedLabel}>COMPLETED</Text>
            <Text style={styles.workoutName}>{workout.name}</Text>
          </View>
        )}

        {profileLoaded && sessionCount === 0 && !userProfile.preferredTime && (
          <View style={styles.contextQuestion}>
            <Text style={styles.contextQuestionPrompt}>WHEN DO YOU USUALLY TRAIN?</Text>
            <View style={styles.ratingButtons}>
              {(['Morning', 'Afternoon', 'Evening'] as const).map((time) => {
                const isSelected = userProfile.preferredTime === time;
                return (
                  <TouchableOpacity
                    key={time}
                    onPress={async () => {
                      const updated = { ...userProfile, preferredTime: time };
                      setUserProfileState(updated);
                      await setUserProfile(updated);
                    }}
                    activeOpacity={0.7}
                    style={[styles.ratingBtn, isSelected && { borderColor: accentColor }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={time}
                  >
                    <Text style={[styles.ratingBtnText, isSelected && { color: accentColor }]}>
                      {time.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {profileLoaded && sessionCount === 2 && !userProfile.primaryGoal && (
          <View style={styles.contextQuestion}>
            <Text style={styles.contextQuestionPrompt}>WHAT&apos;S YOUR MAIN GOAL?</Text>
            <View style={styles.goalButtons}>
              {(['Stress relief', 'Energy', 'Sleep', 'Mood'] as const).map((goal) => {
                const isSelected = userProfile.primaryGoal === goal;
                return (
                  <TouchableOpacity
                    key={goal}
                    onPress={async () => {
                      const updated = { ...userProfile, primaryGoal: goal };
                      setUserProfileState(updated);
                      await setUserProfile(updated);
                    }}
                    activeOpacity={0.7}
                    style={[styles.ratingBtn, isSelected && { borderColor: accentColor }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={goal}
                  >
                    <Text style={[styles.ratingBtnText, isSelected && { color: accentColor }]}>
                      {goal.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Field note */}
        <View style={styles.noteSection}>
          <View style={styles.noteHeader}>
            <Text style={styles.noteLabel}>FIELD NOTES</Text>
            <Text style={styles.noteCount}>{note.length}/140</Text>
          </View>
          <TextInput
            style={[styles.noteInput, note.length > 0 && { borderColor: '#2a2a2a' }]}
            value={note}
            onChangeText={(t) => setNote(t.slice(0, 140))}
            placeholder="What happened in there?"
            placeholderTextColor="#2a2a2a"
            multiline
            numberOfLines={3}
            maxLength={140}
            returnKeyType="done"
            blurOnSubmit
            accessibilityLabel="Session field notes"
          />
        </View>

        {/* Hidden breakthrough card — captured for sharing */}
        {workout && Platform.OS !== 'web' && (
          <View style={styles.hiddenCardWrapper} pointerEvents="none">
            <ViewShot ref={breakthroughRef} options={{ format: 'png', quality: 1 }}>
              <BreakthroughCard
                mood={mood}
                intensity={intensity}
                postScore={postScore}
                workoutName={workout.name}
                duration={workout.duration}
                streak={streak}
              />
            </ViewShot>
          </View>
        )}

        {workout && Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleOpenCardPreview}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Preview and share your result card"
          >
            <Text style={styles.shareButtonEyebrow}>NEW</Text>
            <Text style={styles.shareButtonText}>SEE YOUR CARD →</Text>
          </TouchableOpacity>
        )}

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={styles.logButton}
            onPress={handleLog}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Log session"
            disabled={isSubmitting}
          >
            <Text style={styles.logButtonText}>{isSubmitting ? 'SAVING...' : 'LOG IT →'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      <NotificationPrompt
        visible={showNotifPrompt}
        onClose={() => {
          setShowNotifPrompt(false);
          router.replace('/home');
        }}
      />

      {/* Card preview modal */}
      {workout && (
        <Modal
          visible={showCardPreview}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCardPreview(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalEyebrow}>YOUR RESULT CARD</Text>
              <BreakthroughCard
                mood={mood}
                intensity={intensity}
                postScore={postScore}
                workoutName={workout.name}
                duration={workout.duration}
                streak={streak}
              />
              <TouchableOpacity
                style={[styles.modalShareBtn, { borderColor: accentColor }]}
                onPress={handleShare}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Share this card"
                disabled={isSharing}
              >
                <Text style={[styles.modalShareBtnText, { color: accentColor }]}>
                  {isSharing ? 'PREPARING...' : 'SHARE THIS →'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowCardPreview(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close preview"
              >
                <Text style={styles.modalCloseBtnText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  headline: {
    ...t.headline,
    fontSize: 30,
    textAlign: 'center',
  },
  subtext: {
    ...t.soft,
    textAlign: 'center',
    marginTop: 12,
  },
  insultLine: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#525252',
    marginTop: 16,
    lineHeight: 18,
  },
  pbRow: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },
  pbLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#555',
    letterSpacing: 3,
    marginBottom: 8,
  },
  pbReps: {
    fontSize: 52,
    fontFamily: fonts.mono.regular,
    lineHeight: 56,
  },
  pbNewBest: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#888',
    letterSpacing: 3,
    marginTop: 8,
  },
  pbPrev: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#444',
    letterSpacing: 2,
    marginTop: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginTop: 32,
  },
  scoreSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  howLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    textAlign: 'center',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 16,
  },
  scoreDenom: {
    ...t.dataValue,
    color: '#c8c8c8',
    fontSize: 24,
    fontFamily: fonts.primary.regular,
    marginLeft: 4,
  },
  scoreContext: {
    ...t.bodyMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 40,
    marginVertical: 16,
  },
  changeHero: {
    alignItems: 'center',
    paddingVertical: 24,
    borderTopWidth: 3,
    marginTop: 4,
    width: '100%',
  },
  changeHeroLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#888',
    letterSpacing: 4,
    marginBottom: 8,
  },
  changeHeroValue: {
    fontSize: 64,
    fontFamily: fonts.mono.regular,
    lineHeight: 68,
  },
  changeHeroSub: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#555',
    letterSpacing: 0.5,
    marginTop: 10,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 0,
    width: '100%',
  },
  deltaBlock: {
    flex: 1,
    alignItems: 'center',
  },
  deltaBlockLabel: {
    ...t.label,
    color: '#555',
    letterSpacing: 2,
    fontSize: 9,
    marginBottom: 3,
  },
  deltaBlockValue: {
    ...t.dataValue,
    fontSize: 22,
    color: '#888',
  },
  deltaArrow: {
    ...t.label,
    color: '#333',
    fontSize: 14,
    marginHorizontal: 4,
  },
  workoutInfo: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 20,
    alignItems: 'center',
  },
  completedLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
  },
  workoutName: {
    ...t.headlineSm,
    fontSize: 16,
    marginTop: 4,
  },
  noteSection: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 20,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  noteLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#c8c8c8',
    letterSpacing: 3,
  },
  noteCount: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#c8c8c8',
    letterSpacing: 1,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: '#c8c8c8',
    lineHeight: 20,
    textAlignVertical: 'top',
    minHeight: 72,
  },
  ratingSection: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 24,
  },
  ratingPrompt: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 16,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  ratingBtnText: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 1,
    fontSize: 10,
  },
  contextQuestion: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 24,
  },
  contextQuestionPrompt: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 16,
  },
  goalButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hiddenCardWrapper: {
    position: 'absolute',
    opacity: 0,
    top: -9999,
    left: -9999,
  },
  shareButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#252525',
    paddingVertical: 16,
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0d0d0d',
  },
  shareButtonEyebrow: {
    fontFamily: fonts.mono.regular,
    fontSize: 7,
    color: '#c8c8c8',
    letterSpacing: 4,
  },
  shareButtonText: {
    fontFamily: fonts.mono.regular,
    color: '#c8c8c8',
    letterSpacing: 3,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 380,
  },
  modalEyebrow: {
    fontFamily: fonts.mono.regular,
    fontSize: 8,
    color: '#444444',
    letterSpacing: 4,
  },
  modalShareBtn: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  modalShareBtnText: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    letterSpacing: 3,
  },
  modalCloseBtn: {
    paddingVertical: 10,
  },
  modalCloseBtnText: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#444444',
    letterSpacing: 3,
  },
  logButton: {
    marginTop: 12,
    backgroundColor: '#059669',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 0,
  },
  logButtonText: {
    ...t.button,
    letterSpacing: 4,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: '700' as const,
  },
});