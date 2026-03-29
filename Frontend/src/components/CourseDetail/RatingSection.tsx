'use client';

/**
 * RatingSection Component
 * Sección interactiva de ratings para la página de detalle de curso.
 * Permite al usuario calificar el curso y muestra el rating general.
 */

import { useState, useEffect } from 'react';
import { StarRating } from '@/components/StarRating/StarRating';
import { ratingsApi, ApiError } from '@/services/ratingsApi';
import styles from './RatingSection.module.scss';

// ── Mock data (temporal, sin backend) ────────────────────────────────────────
const USE_MOCK_DATA = true;

const MOCK_RATINGS: Record<number, { userRating: number; averageRating: number; totalRatings: number }> = {
  1: { userRating: 4, averageRating: 4.3, totalRatings: 128 },
  2: { userRating: 0, averageRating: 3.7, totalRatings: 54 },
  3: { userRating: 5, averageRating: 4.8, totalRatings: 312 },
};

function getMockData(courseId: number) {
  return MOCK_RATINGS[courseId] ?? { userRating: 0, averageRating: 0, totalRatings: 0 };
}

function simulateApiDelay(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// ─────────────────────────────────────────────────────────────────────────────

interface RatingSectionProps {
  courseId: number;
  initialAverageRating?: number;
  initialTotalRatings?: number;
  userId: number; // TODO: Reemplazar con userId real de auth
}

/**
 * Calcula el nuevo promedio localmente para optimistic updates
 */
function calculateOptimisticAverage(
  currentAverage: number,
  currentTotal: number,
  oldRating: number,
  newRating: number,
  isNewRating: boolean
): number {
  if (currentTotal === 0 || isNewRating) {
    const sum = currentAverage * currentTotal + newRating;
    return Math.round((sum / (currentTotal + 1)) * 10) / 10;
  }
  const sum = currentAverage * currentTotal - oldRating + newRating;
  return Math.round((sum / currentTotal) * 10) / 10;
}

export const RatingSection = ({
  courseId,
  initialAverageRating = 0,
  initialTotalRatings = 0,
  userId,
}: RatingSectionProps) => {
  const mockInitial = USE_MOCK_DATA ? getMockData(courseId) : null;
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(mockInitial?.averageRating ?? initialAverageRating);
  const [totalRatings, setTotalRatings] = useState(mockInitial?.totalRatings ?? initialTotalRatings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar rating existente del usuario al montar
  useEffect(() => {
    const loadUserRating = async () => {
      if (USE_MOCK_DATA) {
        await simulateApiDelay(300);
        const mock = getMockData(courseId);
        if (mock.userRating > 0) setUserRating(mock.userRating);
        return;
      }

      try {
        const ratings = await ratingsApi.getCourseRatings(courseId);
        const userRatingData = ratings.find((r) => r.user_id === userId);
        if (userRatingData) {
          setUserRating(userRatingData.rating);
        }
      } catch {
        // No crítico: si falla, el usuario simplemente no ve su rating previo
      }
    };

    loadUserRating();
  }, [courseId, userId]);

  const handleRatingChange = async (newRating: number) => {
    const previousRating = userRating;
    const previousAverage = averageRating;
    const previousTotal = totalRatings;
    const isNewRating = previousRating === 0;

    // Optimistic update
    setUserRating(newRating);
    setIsLoading(true);
    setError(null);

    const newAverage = calculateOptimisticAverage(
      previousAverage,
      previousTotal,
      previousRating,
      newRating,
      isNewRating
    );
    setAverageRating(newAverage);
    if (isNewRating) setTotalRatings(previousTotal + 1);

    try {
      if (USE_MOCK_DATA) {
        await simulateApiDelay(600);
        // Actualizar mock en memoria para consistencia dentro de la sesión
        const mock = getMockData(courseId);
        MOCK_RATINGS[courseId] = {
          ...mock,
          userRating: newRating,
          averageRating: newAverage,
          totalRatings: isNewRating ? previousTotal + 1 : previousTotal,
        };
      } else if (isNewRating) {
        await ratingsApi.createRating(courseId, { user_id: userId, rating: newRating });
      } else {
        await ratingsApi.updateRating(courseId, userId, { user_id: userId, rating: newRating });
      }

      setSuccessMessage('Rating guardado exitosamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      // Rollback al estado previo
      setUserRating(previousRating);
      setAverageRating(previousAverage);
      setTotalRatings(previousTotal);

      const errorMessage =
        err instanceof ApiError
          ? err.message
          : 'Error al guardar rating. Por favor intenta de nuevo.';
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={styles.ratingSection}>
      <div className={styles.userRating}>
        <h3 className={styles.title}>Califica este curso</h3>
        <StarRating
          rating={userRating}
          onRatingChange={handleRatingChange}
          size="large"
          disabled={isLoading}
        />

        {isLoading && <p className={styles.loadingText}>Guardando...</p>}

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}

        {successMessage && (
          <p className={styles.successText} role="status">
            {successMessage}
          </p>
        )}
      </div>

      <div className={styles.ratingsStats}>
        <h4 className={styles.statsTitle}>Rating general</h4>
        <StarRating
          rating={averageRating}
          readonly={true}
          size="medium"
          showCount={true}
          totalRatings={totalRatings}
        />
        <p className={styles.statsDescription}>
          Basado en {totalRatings} {totalRatings === 1 ? 'valoración' : 'valoraciones'}
        </p>
      </div>
    </section>
  );
};
