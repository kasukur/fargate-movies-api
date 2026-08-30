import { defineStore } from 'pinia';
import {
  api,
  type CreateMoviePayload,
  type Director,
  type Genre,
  type Movie
} from '../api/client';

interface MoviesState {
  movies: Movie[];
  directors: Director[];
  genres: Genre[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
}

export const useMoviesStore = defineStore('movies', {
  state: (): MoviesState => ({
    movies: [],
    directors: [],
    genres: [],
    loading: false,
    error: null,
    searchTerm: ''
  }),

  getters: {
    directorById: (state) => (id: string) =>
      state.directors.find((d) => d.id === id),
    genreNames: (state) => (ids: string[]) =>
      ids
        .map((id) => state.genres.find((g) => g.id === id)?.name)
        .filter((name): name is string => Boolean(name))
  },

  actions: {
    async fetchMovies(search?: string) {
      this.loading = true;
      this.error = null;
      try {
        const { items } = await api.listMovies(search);
        this.movies = items;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load movies';
      } finally {
        this.loading = false;
      }
    },

    async fetchReferenceData() {
      try {
        const [directors, genres] = await Promise.all([
          api.listDirectors(),
          api.listGenres()
        ]);
        this.directors = directors.items;
        this.genres = genres.items;
      } catch (err) {
        this.error =
          err instanceof Error ? err.message : 'Failed to load reference data';
      }
    },

    async addMovie(payload: CreateMoviePayload): Promise<Movie> {
      const movie = await api.createMovie(payload);
      this.movies = [movie, ...this.movies];
      return movie;
    },

    async removeMovie(id: string) {
      await api.deleteMovie(id);
      this.movies = this.movies.filter((m) => m.id !== id);
    }
  }
});
