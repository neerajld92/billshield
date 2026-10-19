import { SavedReview } from '../types';

const STORAGE_KEY = 'billshield_saved_reviews';

export function getSavedReviews(): SavedReview[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Failed to read saved reviews from localStorage', e);
    return [];
  }
}

export function saveReview(review: SavedReview): boolean {
  try {
    const list = getSavedReviews();
    const existingIndex = list.findIndex((r) => r.id === review.id);
    if (existingIndex >= 0) {
      list[existingIndex] = review;
    } else {
      list.unshift(review);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Failed to save review to localStorage', e);
    return false;
  }
}

export function deleteSavedReview(id: string): boolean {
  try {
    const list = getSavedReviews();
    const updated = list.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Failed to delete review from localStorage', e);
    return false;
  }
}

export function getSavedReview(id: string): SavedReview | null {
  const list = getSavedReviews();
  return list.find((r) => r.id === id) || null;
}
