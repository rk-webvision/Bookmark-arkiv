export interface Bookmark {
  id: string;
  userId: string;
  url: string;
  title: string;
  description: string;
  smartSummary?: string;
  tags: string[];
  category?: string;
  isFavorite?: boolean;
  favicon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  count: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: number;
}
