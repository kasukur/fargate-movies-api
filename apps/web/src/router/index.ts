import { createRouter, createWebHistory } from 'vue-router';
import AddMovieView from '../views/AddMovieView.vue';
import MovieDetailView from '../views/MovieDetailView.vue';
import MoviesView from '../views/MoviesView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'movies', component: MoviesView },
    { path: '/movies/new', name: 'add-movie', component: AddMovieView },
    { path: '/movies/:id', name: 'movie-detail', component: MovieDetailView, props: true }
  ]
});
