import { directorRepository } from '../src/repositories/directorRepository';
import { genreRepository } from '../src/repositories/genreRepository';
import { movieRepository } from '../src/repositories/movieRepository';

async function main(): Promise<void> {
  const existing = await movieRepository.list(1);
  if (existing.items.length > 0) {
    console.log('Table already contains movies, skipping seed.');
    return;
  }

  const nolan = await directorRepository.create({
    name: 'Christopher Nolan',
    bornYear: 1970,
    nationality: 'British-American'
  });
  const gerwig = await directorRepository.create({
    name: 'Greta Gerwig',
    bornYear: 1983,
    nationality: 'American'
  });
  const villeneuve = await directorRepository.create({
    name: 'Denis Villeneuve',
    bornYear: 1967,
    nationality: 'Canadian'
  });

  const scifi = await genreRepository.create({
    name: 'Science Fiction',
    description: 'Speculative futures, technology, and the unknown.'
  });
  const drama = await genreRepository.create({
    name: 'Drama',
    description: 'Character-driven stories with emotional weight.'
  });
  const thriller = await genreRepository.create({
    name: 'Thriller',
    description: 'Tension, suspense, and high stakes.'
  });

  await movieRepository.create({
    title: 'Inception',
    year: 2010,
    directorId: nolan.id,
    genreIds: [scifi.id, thriller.id],
    synopsis: 'A thief who steals corporate secrets through dream-sharing is offered a chance to erase his past.',
    rating: 8.8
  });
  await movieRepository.create({
    title: 'Oppenheimer',
    year: 2023,
    directorId: nolan.id,
    genreIds: [drama.id, thriller.id],
    synopsis: 'The story of J. Robert Oppenheimer and the development of the atomic bomb.',
    rating: 8.4
  });
  await movieRepository.create({
    title: 'Lady Bird',
    year: 2017,
    directorId: gerwig.id,
    genreIds: [drama.id],
    synopsis: 'A headstrong teenager navigates her senior year of high school in Sacramento.',
    rating: 7.4
  });
  await movieRepository.create({
    title: 'Dune: Part Two',
    year: 2024,
    directorId: villeneuve.id,
    genreIds: [scifi.id, drama.id],
    synopsis: 'Paul Atreides unites with the Fremen to wage war against House Harkonnen.',
    rating: 8.5
  });
  await movieRepository.create({
    title: 'Arrival',
    year: 2016,
    directorId: villeneuve.id,
    genreIds: [scifi.id, drama.id],
    synopsis: 'A linguist is recruited to communicate with alien visitors before global tensions boil over.',
    rating: 7.9
  });

  console.log('Seed complete: 3 directors, 3 genres, 5 movies.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
