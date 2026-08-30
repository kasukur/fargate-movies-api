<script setup lang="ts">
import { onMounted } from 'vue';
import MovieCard from '../components/MovieCard.vue';
import SearchBar from '../components/SearchBar.vue';
import { useMoviesStore } from '../stores/movies';

const store = useMoviesStore();

onMounted(() => {
  store.fetchReferenceData();
  store.fetchMovies();
});

function handleSearch(term: string): void {
  store.searchTerm = term;
  store.fetchMovies(term || undefined);
}
</script>

<template>
  <section>
    <h1>Browse movies</h1>
    <SearchBar @search="handleSearch" />

    <div v-if="store.error" class="error-banner" role="alert">{{ store.error }}</div>

    <p v-if="store.loading" class="status-text">Loading movies…</p>

    <p
      v-else-if="store.movies.length === 0"
      class="status-text"
      data-testid="empty-state"
    >
      No movies found. <RouterLink to="/movies/new">Add the first one</RouterLink>.
    </p>

    <div v-else class="movie-grid" data-testid="movie-grid">
      <MovieCard v-for="movie in store.movies" :key="movie.id" :movie="movie" />
    </div>
  </section>
</template>

<style scoped>
.movie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.status-text {
  color: var(--text-muted);
}
</style>
