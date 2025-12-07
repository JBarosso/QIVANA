import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { Question } from '../../lib/quiz';
import { calculateScore } from '../../lib/quiz';
import '../../styles/components/DuelPlayer.scss';

interface DuelData {
  salonId: string;
  salonName: string;
  questions: Question[];
  currentQuestionIndex: number;
  timerSeconds: number;
  isChef: boolean;
  chefId: string;
  currentUserId: string;
  currentUserPseudo: string;
}

interface DuelPlayerProps {
  supabaseUrl: string;
  supabaseKey: string;
  duelData: string; // JSON stringifié
  accessToken?: string | null;
}

export default function DuelPlayer({
  supabaseUrl,
  supabaseKey,
  duelData: duelDataJson,
  accessToken,
}: DuelPlayerProps) {
  const duelData: DuelData = JSON.parse(duelDataJson);
  const {
    salonId,
    salonName,
    questions,
    currentQuestionIndex: initialQuestionIndex,
    timerSeconds,
    isChef,
    currentUserId,
  } = duelData;

  const validatedTimerSeconds = timerSeconds && timerSeconds > 0 ? timerSeconds : 10;

  // État local
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(validatedTimerSeconds);
  const [isLoading, setIsLoading] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [hasAnsweredThisQuestion, setHasAnsweredThisQuestion] = useState(false);
  const [playersStatus, setPlayersStatus] = useState<Array<{
    userId: string;
    pseudo: string;
    hasAnswered: boolean;
    isChef: boolean;
  }>>([]);
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);

  // Client Supabase
  const [supabase] = useState(() => {
    const client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });

    if (accessToken && typeof window !== 'undefined') {
      client.auth.setSession({
        access_token: accessToken,
        refresh_token: '',
      } as any).catch((error) => {
        console.warn('Could not set session from token:', error);
      });
    }

    return client;
  });

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // Charger le statut des joueurs (pour le chef)
  const loadPlayersStatus = useCallback(async () => {
    if (!isChef || !currentQuestion?.id) {
      console.log('⏭️ Skipping loadPlayersStatus:', { isChef, questionId: currentQuestion?.id });
      return;
    }

    try {
      console.log('📊 Loading players status for question:', currentQuestion.id);
      const response = await fetch(`/api/duel/play-status?salonId=${salonId}&questionId=${currentQuestion.id}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Players status loaded:', data);
        if (data.players) {
          setPlayersStatus(data.players);
          console.log('👥 Players status updated:', data.players.map((p: any) => ({
            pseudo: p.pseudo,
            hasAnswered: p.hasAnswered,
          })));
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error loading players status:', response.status, errorData);
      }
    } catch (error) {
      console.error('❌ Error loading players status:', error);
    }
  }, [isChef, salonId, currentQuestion?.id]);

  // Vérifier si l'utilisateur a déjà répondu à cette question
  useEffect(() => {
    const checkAnswer = async () => {
      try {
        const { data, error } = await supabase
          .from('duel_answers')
          .select('*')
          .eq('duel_session_id', salonId)
          .eq('user_id', currentUserId)
          .eq('question_id', currentQuestion?.id)
          .maybeSingle();

        if (!error && data) {
          setHasAnsweredThisQuestion(true);
          setIsAnswered(true);
          setSelectedAnswer(data.selected_index);
          setPointsEarned(data.points_earned || 0);
        } else {
          setHasAnsweredThisQuestion(false);
          setIsAnswered(false);
          setSelectedAnswer(null);
          setPointsEarned(0);
        }
      } catch (error) {
        console.error('Error checking answer:', error);
      }
    };

    if (currentQuestion?.id) {
      checkAnswer();
      // Réinitialiser le timer pour la nouvelle question
      setTimeRemaining(validatedTimerSeconds);
      // Charger le statut des joueurs pour le chef immédiatement
      if (isChef) {
        // Charger immédiatement sans délai
        loadPlayersStatus();
      }
    }
  }, [currentQuestionIndex, currentQuestion?.id, salonId, currentUserId, validatedTimerSeconds, supabase, isChef, loadPlayersStatus]);

  // Charger le statut des joueurs quand on ouvre le panneau
  useEffect(() => {
    if (isChef && showPlayersPanel && currentQuestion?.id) {
      console.log('📊 Loading players status (panel opened)');
      loadPlayersStatus();
    }
  }, [showPlayersPanel, isChef, currentQuestion?.id, loadPlayersStatus]);

    // S'abonner aux changements du salon (question actuelle, status, etc.)
    useEffect(() => {
      const channel = supabase
        .channel(`duel-play-${salonId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'duel_sessions',
            filter: `id=eq.${salonId}`,
          },
          (payload) => {
            console.log('🔄 Duel update received:', payload.new);
            if (payload.new) {
              // Vérifier si l'utilisateur a été expulsé (pas le chef)
              if (!isChef && payload.new.participants) {
                const participants = Array.isArray(payload.new.participants) ? payload.new.participants : [];
                const isStillParticipant = participants.some((p: any) => p.id === currentUserId);
                
                if (!isStillParticipant) {
                  console.log('🚫 User has been expelled from duel');
                  alert('Vous avez été expulsé du duel par le chef.');
                  window.location.href = '/';
                  return;
                }
              }

              // Mettre à jour l'index de la question actuelle (via Realtime, pas de délai)
              if (payload.new.current_question_index !== undefined) {
                const newIndex = payload.new.current_question_index;
                console.log('📝 Question index updated via Realtime:', newIndex);
                setCurrentQuestionIndex(newIndex);
                // Recharger le statut des joueurs si on est le chef (via Realtime, immédiatement)
                if (isChef) {
                  console.log('🔄 Reloading players status after question change (via Realtime)');
                  loadPlayersStatus();
                }
              }

              // Mettre à jour la liste des participants si elle change (pour le chef, via Realtime)
              if (isChef && payload.new.participants) {
                console.log('🔄 Reloading players status after participants change (via Realtime)');
                loadPlayersStatus();
              }

              // Si le duel est terminé, rediriger vers les résultats
              if (payload.new.status === 'completed') {
                window.location.href = `/duel/results?salon=${salonId}`;
              }
            }
          }
        )
        // ============================================
        // LISTENER 2: Nouvelles réponses (via Realtime)
        // ============================================
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'duel_answers',
            filter: `duel_session_id=eq.${salonId}`,
          },
          (payload) => {
            console.log('✅ New answer received via Realtime:', payload.new);
            const newAnswer = payload.new;
            
            // Vérifier si c'est pour la question actuelle
            if (newAnswer.question_id === currentQuestion?.id) {
              console.log('🔄 New answer for current question, updating status immediately via Realtime');
              
              // ============================================
              // MISE À JOUR IMMÉDIATE VIA REALTIME (pas de polling)
              // ============================================
              
              // Pour le chef : recharger le statut complet depuis l'API (via Realtime)
              if (isChef) {
                // Recharger immédiatement via Realtime (pas de délai, pas de polling)
                loadPlayersStatus();
              }
              
              // Pour tous : mettre à jour localement immédiatement si on connaît le joueur
              // Optimisation : mise à jour directe du state sans attendre l'API
              if (newAnswer.user_id && playersStatus.length > 0) {
                setPlayersStatus((prev) =>
                  prev.map((player) =>
                    player.userId === newAnswer.user_id
                      ? { ...player, hasAnswered: true }
                      : player
                  )
                );
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Duel Realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to ALL Realtime updates (duel_sessions + duel_answers)');
            console.log('📊 Realtime handles: participants, questions, status, answers - NO POLLING NEEDED');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Realtime subscription error - falling back to polling');
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }, [supabase, salonId, isChef, loadPlayersStatus, currentUserId, showPlayersPanel, currentQuestion?.id]);

    // Polling de secours TRÈS rare (30 secondes) - uniquement si Realtime échoue complètement
    // En théorie, Realtime devrait gérer TOUTES les mises à jour en temps réel
    useEffect(() => {
      if (!isChef || !currentQuestion?.id || !showPlayersPanel) return;

      // Polling de secours très rare (30 secondes) - seulement en cas de problème Realtime
      const interval = setInterval(() => {
        console.warn('⚠️ Polling fallback triggered (Realtime may have failed)');
        loadPlayersStatus();
      }, 30000); // Polling de secours toutes les 30 secondes seulement (fallback d'urgence)

      return () => clearInterval(interval);
    }, [isChef, currentQuestion?.id, showPlayersPanel, loadPlayersStatus]);

  // Timer synchronisé
  useEffect(() => {
    if (isAnswered || hasAnsweredThisQuestion) {
      return; // Ne pas lancer le timer si déjà répondu
    }

    if (timeRemaining <= 0) {
      // Timeout : répondre automatiquement avec null
      handleAnswer(null, true);
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, isAnswered, hasAnsweredThisQuestion]);

  const handleAnswer = useCallback(
    async (answerIndex: number | null, isTimeout: boolean = false) => {
      if (isAnswered || hasAnsweredThisQuestion) return;

      setIsAnswered(true);
      setSelectedAnswer(answerIndex);

      // Calculer le score
      const isCorrect = answerIndex === currentQuestion.correct_index;
      const points = calculateScore(isCorrect, Math.max(0, timeRemaining), validatedTimerSeconds);
      setPointsEarned(points);

      // Sauvegarder la réponse
      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append('salon_id', salonId);
        formData.append('question_id', currentQuestion.id);
        formData.append('question_index', currentQuestionIndex.toString());
        formData.append('selected_index', answerIndex !== null ? answerIndex.toString() : '-1');
        formData.append('time_remaining', timeRemaining.toString());

        const response = await fetch('/api/duel/answer', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Erreur lors de la sauvegarde');
        }

        console.log('✅ Answer saved successfully');
      } catch (error) {
        console.error('Error saving answer:', error);
        alert('Erreur lors de la sauvegarde de la réponse');
      } finally {
        setIsLoading(false);
      }
    },
    [
      salonId,
      currentQuestionIndex,
      currentQuestion,
      timeRemaining,
      validatedTimerSeconds,
      isAnswered,
      hasAnsweredThisQuestion,
    ]
  );

  if (!currentQuestion) {
    return (
      <div className="duel-player">
        <p className="duel-player__error">Question introuvable</p>
      </div>
    );
  }

  const isCorrect = selectedAnswer === currentQuestion.correct_index;
  const showResult = isAnswered || hasAnsweredThisQuestion;

  return (
    <div className="duel-player">
      <header className="duel-player__header">
        <div className="duel-player__header-top">
          <h1 className="duel-player__title">{salonName}</h1>
          {isChef && (
            <button
              className="duel-player__players-btn"
              onClick={() => setShowPlayersPanel(!showPlayersPanel)}
              title="Voir les participants"
            >
              👥 {playersStatus.length > 0 ? `${playersStatus.filter((p) => p.hasAnswered).length}/${playersStatus.length}` : ''}
            </button>
          )}
        </div>
        <div className="duel-player__progress">
          <span className="duel-player__progress-text">
            Question {currentQuestionIndex + 1} / {totalQuestions}
          </span>
          <div className="duel-player__progress-bar">
            <div
              className="duel-player__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Panneau des participants (chef uniquement) */}
      {isChef && showPlayersPanel && (
        <div className="duel-player__players-panel">
          <h3 className="duel-player__players-panel-title">
            Participants
            {playersStatus.length > 0 && (
              <span className="duel-player__players-panel-count">
                ({playersStatus.filter((p) => p.hasAnswered).length}/{playersStatus.length} répondu{playersStatus.filter((p) => p.hasAnswered).length > 1 ? 's' : ''})
              </span>
            )}
          </h3>
          <ul className="duel-player__players-list">
            {playersStatus.map((player) => (
              <li
                key={player.userId}
                className={`duel-player__player-item ${player.hasAnswered ? 'duel-player__player-item--answered' : ''}`}
              >
                <span className="duel-player__player-name">
                  {player.pseudo}
                  {player.isChef && <span className="duel-player__player-badge">👑 Chef</span>}
                </span>
                <span className="duel-player__player-status">
                  {player.hasAnswered ? '✅ Répondu' : '⏳ En attente'}
                </span>
                {!player.isChef && (
                  <button
                    className="duel-player__kick-btn"
                    onClick={async () => {
                      if (!confirm(`Expulser ${player.pseudo} du duel ?`)) {
                        return;
                      }

                      try {
                        const formData = new FormData();
                        formData.append('salon_id', salonId);
                        formData.append('participant_id', player.userId);

                        const response = await fetch('/api/duel/kick', {
                          method: 'POST',
                          body: formData,
                        });

                        if (!response.ok) {
                          const errorData = await response.json().catch(() => ({}));
                          alert(`Erreur: ${errorData.error || 'Impossible d\'expulser le joueur'}`);
                        } else {
                          // Realtime devrait mettre à jour automatiquement, mais on recharge pour être sûr
                          setTimeout(() => {
                            loadPlayersStatus();
                          }, 300);
                        }
                      } catch (error) {
                        console.error('Error expelling player:', error);
                        alert('Erreur lors de l\'expulsion');
                      }
                    }}
                    title={`Expulser ${player.pseudo}`}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {/* Indicateur visuel quand tous ont répondu */}
          {playersStatus.length > 0 && playersStatus.every((p) => p.hasAnswered) && (
            <div className="duel-player__players-all-answered">
              ✅ Tous les joueurs ont répondu !
            </div>
          )}
        </div>
      )}

      <div className="duel-player__question-card">
        <h2 className="duel-player__question-text">{currentQuestion.question}</h2>

        {!showResult && (
          <div className="duel-player__timer">
            <div className="duel-player__timer-bar">
              <div
                className="duel-player__timer-fill"
                style={{
                  width: `${(timeRemaining / validatedTimerSeconds) * 100}%`,
                  backgroundColor: timeRemaining <= 3 ? '#EC4899' : '#0EA5E9',
                }}
              />
            </div>
            <span className="duel-player__timer-text">{timeRemaining}s</span>
          </div>
        )}

        <div className="duel-player__answers">
          {currentQuestion.choices.map((choice, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrectAnswer = index === currentQuestion.correct_index;
            let answerClass = 'duel-player__answer';

            if (showResult) {
              if (isCorrectAnswer) {
                answerClass += ' duel-player__answer--correct';
              } else if (isSelected && !isCorrect) {
                answerClass += ' duel-player__answer--incorrect';
              }
            } else if (isSelected) {
              answerClass += ' duel-player__answer--selected';
            }

            return (
              <button
                key={index}
                className={answerClass}
                onClick={() => handleAnswer(index)}
                disabled={isAnswered || hasAnsweredThisQuestion || isLoading}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {showResult && (
          <div className="duel-player__result">
            <p className={`duel-player__result-text ${isCorrect ? 'duel-player__result-text--correct' : 'duel-player__result-text--incorrect'}`}>
              {isCorrect ? '✅ Correct !' : '❌ Incorrect'}
            </p>
            <p className="duel-player__result-explanation">{currentQuestion.explanation}</p>
            <p className="duel-player__result-points">+{pointsEarned} points</p>
          </div>
        )}

        {isChef && showResult && currentQuestionIndex < totalQuestions - 1 && (
          <div className="duel-player__next-section">
            <button
              className="duel-player__next-btn btn btn--primary"
              onClick={async () => {
                try {
                  const formData = new FormData();
                  formData.append('salon_id', salonId);
                  formData.append('force', 'false');

                  const response = await fetch('/api/duel/next-question', {
                    method: 'POST',
                    body: formData,
                  });

                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.log('❌ Error moving to next question:', errorData);
                    
                    // Si tous les joueurs n'ont pas répondu, proposer de forcer
                    if (errorData.canForce) {
                      // Avec Realtime, le statut devrait être à jour, mais on recharge quand même pour être sûr
                      await loadPlayersStatus();
                      
                      // Vérifier le statut actuel depuis le state (plus rapide que de recharger)
                      const allAnswered = playersStatus.every((p) => p.hasAnswered);
                      const answeredCount = playersStatus.filter((p) => p.hasAnswered).length;
                      const totalCount = playersStatus.length;
                      
                      console.log('📊 Current status from state:', {
                        allAnswered,
                        answeredCount,
                        totalCount,
                      });
                      
                      // Si tous ont répondu selon notre state, réessayer immédiatement
                      if (allAnswered && answeredCount === totalCount && totalCount > 0) {
                        console.log('✅ All players answered according to state, retrying...');
                        const retryFormData = new FormData();
                        retryFormData.append('salon_id', salonId);
                        retryFormData.append('force', 'false');

                        const retryResponse = await fetch('/api/duel/next-question', {
                          method: 'POST',
                          body: retryFormData,
                        });

                        if (!retryResponse.ok) {
                          const retryErrorData = await retryResponse.json().catch(() => ({}));
                          // Si ça échoue encore, il y a peut-être un délai de réplication DB
                          const shouldForce = confirm(
                            `${retryErrorData.error || errorData.error}\n\n` +
                            `Selon l'interface: ${answeredCount} / ${totalCount} joueurs ont répondu.\n` +
                            `Le serveur indique: ${retryErrorData.answered || errorData.answered} / ${retryErrorData.total || errorData.total} joueurs.\n\n` +
                            `Voulez-vous forcer le passage à la question suivante ?`
                          );

                          if (shouldForce) {
                            const forceFormData = new FormData();
                            forceFormData.append('salon_id', salonId);
                            forceFormData.append('force', 'true');

                            const forceResponse = await fetch('/api/duel/next-question', {
                              method: 'POST',
                              body: forceFormData,
                            });

                            if (!forceResponse.ok) {
                              const forceErrorData = await forceResponse.json().catch(() => ({}));
                              alert(`Erreur: ${forceErrorData.error || 'Impossible de forcer le passage'}`);
                            }
                          }
                        }
                      } else {
                        // Pas tous répondu selon notre state, proposer de forcer
                        const shouldForce = confirm(
                          `${errorData.error}\n\n` +
                          `${answeredCount} / ${totalCount} joueurs ont répondu.\n\n` +
                          `Voulez-vous forcer le passage à la question suivante ?`
                        );

                        if (shouldForce) {
                          const forceFormData = new FormData();
                          forceFormData.append('salon_id', salonId);
                          forceFormData.append('force', 'true');

                          const forceResponse = await fetch('/api/duel/next-question', {
                            method: 'POST',
                            body: forceFormData,
                          });

                          if (!forceResponse.ok) {
                            const forceErrorData = await forceResponse.json().catch(() => ({}));
                            alert(`Erreur: ${forceErrorData.error || 'Impossible de forcer le passage'}`);
                          }
                        }
                      }
                    } else {
                      alert(`Erreur: ${errorData.error || 'Impossible de passer à la question suivante'}`);
                    }
                  } else {
                    // Succès, recharger le statut des joueurs
                    if (isChef) {
                      setTimeout(() => loadPlayersStatus(), 1000);
                    }
                  }
                } catch (error) {
                  console.error('Error moving to next question:', error);
                  alert('Erreur lors du passage à la question suivante');
                }
              }}
            >
              Question suivante →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
