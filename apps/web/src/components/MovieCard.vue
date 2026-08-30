<script setup lang="ts">
import { computed } from 'vue';
import type { Movie } from '../api/client';
import { useMoviesStore } from '../stores/movies';

const props = defineProps<{ movie: Movie }>();
const store = useMoviesStore();

const directorName = computed(
  () => store.directorById(props.movie.directorId)?.name ?? 'Unknown director'
);
const genres = computed(() => store.genreNames(props.movie.genreIds));
</script>

<template>
  <article class="card movie-card" data-testid="movie-card">
    <div class="movie-header">
      <h3 class="movie-title">
        <RouterLink :to="`/movies/${movie.id}`" data-testid="movie-title">
          {{ movie.title }}
        </RouterLink>
      </h3>
      <span class="movie-year">{{ movie.year }}</span>
    </div>
    <p class="movie-director">{{ directorName }}</p>
    <div class="genre-tags">
      <span v-for="genre in genres" :key="genre" class="genre-tag">{{ genre }}</span>
    </div>
    <p v-if="movie.rating != null" class="movie-rating">★ {{ movie.rating.toFixed(1) }}</p>
  </article>
</template>

<style scoped>
.movie-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: border-color 0.15s ease;
}

.movie-card:hover {
  border-color: var(--accent);
}

.movie-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.movie-title {
  margin: 0;
  font-size: 1.1rem;
}

.movie-year {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.movie-director {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.genre-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.genre-tag {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.1rem 0.6rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.movie-rating {
  margin: 0;
  color: var(--accent);
  font-weight: 600;
}
</style>
