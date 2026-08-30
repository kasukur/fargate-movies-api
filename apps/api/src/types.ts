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
  createdAt: string;
  updatedAt: string;
}

export interface Genre {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PagedResult<T> {
  items: T[];
  nextCursor?: string;
}
