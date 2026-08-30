<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, type Movie } from '../api/client';
import { useMoviesStore } from '../stores/movies';

const props = defineProps<{ id: string }>();
const store = useMoviesStore();
const router = useRouter();

const movie = ref<Movie | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const deleting = ref(false);

const directorName = computed(() =>
  movie.value ? store.directorById(movie.value.directorId)?.name ?? 'Unknown' : ''
);
const genres = computed(() =>
  movie.value ? store.genreNames(movie.value.genreIds) : []
);

onMounted(async () => {
  if (store.directors.length === 0 || store.genres.length === 0) {
    await store.fetchReferenceData();
  }
  try {
    movie.value = await api.getMovie(props.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load movie';
  } finally {
    loading.value = false;
  }
});

async function remove(): Promise<void> {
  if (!movie.value) return;
  deleting.value = true;
  try {
    await store.removeMovie(movie.value.id);
    router.push({ name: 'movies' });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete movie';
    deleting.value = false;
  }
}
</script>

<template>
  <section>
    <p v-if="loading" class="status-text">Loading…</p>
    <div v-else-if="error" class="error-banner" role="alert">{{ error }}</div>

    <article v-else-if="movie" class="card detail" data-testid="movie-detail">
      <header class="detail-header">
        <h1>{{ movie.title }} <span class="year">({{ movie.year }})</span></h1>
        <p v-if="movie.rating != null" class="rating">★ {{ movie.rating.toFixed(1) }}</p>
      </header>

      <dl class="meta">
        <dt>Director</dt>
        <dd>{{ directorName }}</dd>
        <dt>Genres</dt>
        <dd>{{ genres.join(', ') || '—' }}</dd>
      </dl>

      <p v-if="movie.synopsis" class="synopsis">{{ movie.synopsis }}</p>

      <div class="actions">
        <RouterLink to="/" class="btn btn-secondary">Back to list</RouterLink>
        <button
          class="btn danger"
          :disabled="deleting"
          data-testid="delete-movie"
          @click="remove"
        >
          {{ deleting ? 'Deleting…' : 'Delete movie' }}
        </button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.detail-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.detail-header h1 {
  margin: 0;
}

.year {
  color: var(--text-muted);
  font-weight: 400;
}

.rating {
  color: var(--accent);
  font-weight: 700;
  font-size: 1.2rem;
}

.meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1.25rem;
  margin: 1rem 0;
}

.meta dt {
  color: var(--text-muted);
  font-weight: 600;
}

.meta dd {
  margin: 0;
}

.synopsis {
  color: var(--text);
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.danger {
  background: var(--danger);
  color: #fff;
}

.danger:hover {
  background: #dc2626;
}

.status-text {
  color: var(--text-muted);
}
</style>
