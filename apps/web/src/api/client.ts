export interface Movie {
  id: string;
  title: string;
  year: number;
  directorId: string;
  genreIds: string[];
  synopsis?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Director {
  id: string;
  name: string;
  bornYear?: number;
  nationality?: string;
}

export interface Genre {
  id: string;
  name: string;
  description?: string;
}

export interface CreateMoviePayload {
  title: string;
  year: number;
  directorId: string;
  genreIds: string[];
  synopsis?: string;
  rating?: number;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // response body was not JSON; keep the default message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  listMovies: (search?: string) =>
    request<{ items: Movie[] }>(
      search ? `/api/movies?search=${encodeURIComponent(search)}` : '/api/movies'
    ),
  getMovie: (id: string) => request<Movie>(`/api/movies/${id}`),
  createMovie: (payload: CreateMoviePayload) =>
    request<Movie>('/api/movies', { method: 'POST', body: JSON.stringify(payload) }),
  deleteMovie: (id: string) =>
    request<void>(`/api/movies/${id}`, { method: 'DELETE' }),
  listDirectors: () => request<{ items: Director[] }>('/api/directors'),
  createDirector: (payload: { name: string; bornYear?: number; nationality?: string }) =>
    request<Director>('/api/directors', { method: 'POST', body: JSON.stringify(payload) }),
  listGenres: () => request<{ items: Genre[] }>('/api/genres'),
  createGenre: (payload: { name: string; description?: string }) =>
    request<Genre>('/api/genres', { method: 'POST', body: JSON.stringify(payload) })
};
