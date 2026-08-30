<script setup lang="ts">
import { ref, watch } from 'vue';

const emit = defineEmits<{ search: [term: string] }>();
const term = ref('');
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

watch(term, (value) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => emit('search', value.trim()), 300);
});
</script>

<template>
  <div class="search-bar">
    <input
      v-model="term"
      type="search"
      placeholder="Search movies by title…"
      aria-label="Search movies"
      data-testid="search-input"
    />
  </div>
</template>

<style scoped>
.search-bar {
  margin-bottom: 1.5rem;
}
</style>
