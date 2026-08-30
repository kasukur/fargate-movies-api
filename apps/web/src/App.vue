<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <header class="app-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand">🎬 Movies</RouterLink>
      <nav>
        <RouterLink to="/" class="nav-link">Browse</RouterLink>
        <RouterLink to="/movies/new" class="btn nav-cta">Add movie</RouterLink>
      </nav>
    </div>
  </header>
  <main class="container">
    <RouterView />
  </main>
</template>

<style scoped>
.app-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.brand {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-link {
  color: var(--text-muted);
}

.nav-link.router-link-exact-active {
  color: var(--accent);
}

.nav-cta {
  padding: 0.45rem 1rem;
}
</style>
