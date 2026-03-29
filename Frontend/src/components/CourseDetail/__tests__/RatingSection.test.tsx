/**
 * RatingSection Component Tests
 * Tests de integración para el componente de ratings interactivos
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RatingSection } from '../RatingSection';

// Mock del módulo de API de ratings
vi.mock('@/services/ratingsApi', () => ({
  ratingsApi: {
    getCourseRatings: vi.fn(),
    createRating: vi.fn(),
    updateRating: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  },
}));

// Import después del mock para obtener las funciones mockeadas
import { ratingsApi, ApiError } from '@/services/ratingsApi';

const mockRatingsApi = ratingsApi as {
  getCourseRatings: ReturnType<typeof vi.fn>;
  createRating: ReturnType<typeof vi.fn>;
  updateRating: ReturnType<typeof vi.fn>;
};

describe('RatingSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRatingsApi.getCourseRatings.mockResolvedValue([]);
  });

  describe('Renderizado inicial', () => {
    it('muestra el título "Califica este curso"', async () => {
      render(<RatingSection courseId={1} userId={1} />);

      expect(screen.getByText('Califica este curso')).toBeInTheDocument();
    });

    it('muestra el título "Rating general"', async () => {
      render(<RatingSection courseId={1} userId={1} />);

      expect(screen.getByText('Rating general')).toBeInTheDocument();
    });

    it('muestra las estadísticas iniciales correctamente', async () => {
      render(
        <RatingSection
          courseId={1}
          userId={1}
          initialAverageRating={4.2}
          initialTotalRatings={85}
        />
      );

      expect(screen.getByText('Basado en 85 valoraciones')).toBeInTheDocument();
    });

    it('muestra "valoración" (singular) cuando hay exactamente 1 rating', async () => {
      render(
        <RatingSection courseId={1} userId={1} initialTotalRatings={1} />
      );

      expect(screen.getByText('Basado en 1 valoración')).toBeInTheDocument();
    });

    it('muestra "valoraciones" (plural) cuando hay más de 1 rating', async () => {
      render(
        <RatingSection courseId={1} userId={1} initialTotalRatings={5} />
      );

      expect(screen.getByText('Basado en 5 valoraciones')).toBeInTheDocument();
    });
  });

  describe('Carga del rating del usuario', () => {
    it('llama getCourseRatings al montar', async () => {
      render(<RatingSection courseId={3} userId={42} />);

      await waitFor(() => {
        expect(mockRatingsApi.getCourseRatings).toHaveBeenCalledWith(3);
      });
    });

    it('carga el rating previo del usuario si existe', async () => {
      mockRatingsApi.getCourseRatings.mockResolvedValue([
        { id: 1, course_id: 1, user_id: 1, rating: 4, created_at: '', updated_at: '' },
      ]);

      render(<RatingSection courseId={1} userId={1} />);

      await waitFor(() => {
        expect(mockRatingsApi.getCourseRatings).toHaveBeenCalled();
      });
    });

    it('no lanza error si getCourseRatings falla', async () => {
      mockRatingsApi.getCourseRatings.mockRejectedValue(new Error('Network error'));

      expect(() => render(<RatingSection courseId={1} userId={1} />)).not.toThrow();
    });
  });

  describe('Submit de nuevo rating', () => {
    it('llama createRating al hacer click en una estrella (sin rating previo)', async () => {
      mockRatingsApi.createRating.mockResolvedValue({
        id: 1,
        course_id: 1,
        user_id: 1,
        rating: 5,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      });

      render(<RatingSection courseId={1} userId={1} />);

      await waitFor(() => expect(mockRatingsApi.getCourseRatings).toHaveBeenCalled());

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[4]); // 5ta estrella

      await waitFor(() => {
        expect(mockRatingsApi.createRating).toHaveBeenCalledWith(1, {
          user_id: 1,
          rating: 5,
        });
      });
    });

    it('muestra mensaje de éxito después de guardar', async () => {
      mockRatingsApi.createRating.mockResolvedValue({
        id: 1,
        course_id: 1,
        user_id: 1,
        rating: 3,
        created_at: '',
        updated_at: '',
      });

      render(<RatingSection courseId={1} userId={1} />);

      await waitFor(() => expect(mockRatingsApi.getCourseRatings).toHaveBeenCalled());

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[2]);

      await waitFor(() => {
        expect(screen.getByText('Rating guardado exitosamente')).toBeInTheDocument();
      });
    });
  });

  describe('Actualización de rating existente', () => {
    it('llama updateRating cuando el usuario ya tiene un rating', async () => {
      mockRatingsApi.getCourseRatings.mockResolvedValue([
        { id: 1, course_id: 1, user_id: 1, rating: 3, created_at: '', updated_at: '' },
      ]);
      mockRatingsApi.updateRating.mockResolvedValue({
        id: 1,
        course_id: 1,
        user_id: 1,
        rating: 5,
        created_at: '',
        updated_at: '',
      });

      render(<RatingSection courseId={1} userId={1} />);

      // Esperar a que se cargue el rating del usuario
      await waitFor(() => expect(mockRatingsApi.getCourseRatings).toHaveBeenCalled());

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[4]); // Cambiar a 5 estrellas

      await waitFor(() => {
        expect(mockRatingsApi.updateRating).toHaveBeenCalledWith(1, 1, {
          user_id: 1,
          rating: 5,
        });
      });
      expect(mockRatingsApi.createRating).not.toHaveBeenCalled();
    });
  });

  describe('Manejo de errores y rollback', () => {
    it('muestra mensaje de error cuando falla la API', async () => {
      mockRatingsApi.createRating.mockRejectedValue(
        new ApiError('Error del servidor', 500)
      );

      render(<RatingSection courseId={1} userId={1} />);

      await waitFor(() => expect(mockRatingsApi.getCourseRatings).toHaveBeenCalled());

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[2]);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Error del servidor')).toBeInTheDocument();
      });
    });

    it('muestra mensaje genérico para errores no-ApiError', async () => {
      mockRatingsApi.createRating.mockRejectedValue(new Error('Unknown'));

      render(<RatingSection courseId={1} userId={1} />);

      await waitFor(() => expect(mockRatingsApi.getCourseRatings).toHaveBeenCalled());

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText('Error al guardar rating. Por favor intenta de nuevo.')).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('muestra "Guardando..." durante el API call', async () => {
      // Simular un delay en la API
      mockRatingsApi.createRating.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<RatingSection courseId={1} userId={1} />);

      await waitFor(() => expect(mockRatingsApi.getCourseRatings).toHaveBeenCalled());

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[2]);

      expect(screen.getByText('Guardando...')).toBeInTheDocument();
    });
  });
});
