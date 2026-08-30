<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies';

const store = useMoviesStore();
const router = useRouter();

const form = reactive({
  title: '',
  year: new Date().getFullYear(),
  directorId: '',
  genreIds: [] as string[],
  synopsis: '',
  rating: undefined as number | undefined
});

const submitting = ref(false);
const error = ref<string | null>(null);

onMounted(() => {
  if (store.directors.length === 0 || store.genres.length === 0) {
    store.fetchReferenceData();
  }
});

async function submit(): Promise<void> {
  error.value = null;

  if (!form.title.trim()) {
    error.value = 'Title is required.';
    return;
  }
  if (!form.directorId) {
    error.value = 'Please select a director.';
    return;
  }
  if (form.genreIds.length === 0) {
    error.value = 'Please select at least one genre.';
    return;
  }

  submitting.value = true;
  try {
    await store.addMovie({
      title: form.title.trim(),
      year: form.year,
      directorId: form.directorId,
      genreIds: form.genreIds,
      synopsis: form.synopsis.trim() || undefined,
      rating: form.rating
    });
    router.push({ name: 'movies' });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to add movie';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="add-movie">
    <h1>Add a movie</h1>

    <div v-if="error" class="error-banner" role="alert" data-testid="form-error">
      {{ error }}
    </div>

    <form class="card form" data-testid="add-movie-form" @submit.prevent="submit">
      <label>
        Title
        <input
          v-model="form.title"
          type="text"
          required
          maxlength="200"
          data-testid="title-input"
        />
      </label>

      <label>
        Release year
        <input
          v-model.number="form.year"
          type="number"
          min="1888"
          max="2100"
          required
          data-testid="year-input"
        />
      </label>

      <label>
        Director
        <select v-model="form.directorId" required data-testid="director-select">
          <option value="" disabled>Select a director…</option>
          <option v-for="d in store.directors" :key="d.id" :value="d.id">
            {{ d.name }}
          </option>
        </select>
      </label>

      <fieldset class="genre-fieldset">
        <legend>Genres</legend>
        <label
          v-for="g in store.genres"
          :key="g.id"
          class="checkbox-label"
        >
          <input
            v-model="form.genreIds"
            type="checkbox"
            :value="g.id"
            :data-testid="`genre-checkbox-${g.name.toLowerCase().replace(/\s+/g, '-')}`"
          />
          {{ g.name }}
        </label>
      </fieldset>

      <label>
        Synopsis (optional)
        <textarea
          v-model="form.synopsis"
          rows="4"
          maxlength="2000"
          data-testid="synopsis-input"
        ></textarea>
      </label>

      <label>
        Rating 0–10 (optional)
        <input
          v-model.number="form.rating"
          type="number"
          min="0"
          max="10"
          step="0.1"
          data-testid="rating-input"
        />
      </label>

      <div class="actions">
        <button
          type="submit"
          class="btn"
          :disabled="submitting"
          data-testid="submit-movie"
        >
          {{ submitting ? 'Saving…' : 'Add movie' }}
        </button>
        <RouterLink to="/" class="btn btn-secondary">Cancel</RouterLink>
      </div>
    </form>
  </section>
</template>

<style scoped>
.add-movie {
  max-width: 560px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.genre-fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.genre-fieldset legend {
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0 0.4rem;
}

.checkbox-label {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  font-weight: 400;
}

.checkbox-label input {
  width: auto;
}

.actions {
  display: flex;
  gap: 0.75rem;
}
</style>
