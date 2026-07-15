import { resolveSessionStorage } from "./toolkit/session/redis.js";
import type { StorageAdapter } from "grammy";

export interface DataStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

const stores = new WeakMap<object, DataStore>();

function createDataStore(): DataStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = resolveSessionStorage<Record<string, any>>(undefined);
  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return adapter.read(key) as T | undefined;
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      await adapter.write(key, value as Record<string, any>);
    },
    async delete(key: string): Promise<void> {
      await adapter.delete(key);
    },
  };
}

export function getDataStore(apiInstance: object): DataStore {
  let store = stores.get(apiInstance);
  if (!store) {
    store = createDataStore();
    stores.set(apiInstance, store);
  }
  return store;
}

// Data keys
export const SERVICES_KEY = "glowe:services";
export const PORTFOLIO_KEY = "glowe:portfolio";
export const REVIEWS_KEY = "glowe:reviews";

export interface ServiceData {
  id: string;
  title: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  active: boolean;
}

export interface PortfolioData {
  id: string;
  caption: string;
  serviceCategory: string;
  tags: string[];
}

export interface ReviewData {
  id: string;
  rating: number;
  text: string;
  photos: string[];
  bookingRef: string;
  userId: number;
  userName: string;
  adminReply?: string;
  createdAt: string;
}

export const DEFAULT_SERVICES: ServiceData[] = [
  { id: "haircut", title: "Haircut", description: "Classic cut and style", duration: 45, price: 45, category: "Hair", active: true },
  { id: "color", title: "Hair Color", description: "Full color or highlights", duration: 90, price: 85, category: "Hair", active: true },
  { id: "blowout", title: "Blowout", description: "Wash and blow dry styling", duration: 30, price: 35, category: "Hair", active: true },
  { id: "manicure", title: "Manicure", description: "Classic nail care and polish", duration: 30, price: 25, category: "Nails", active: true },
  { id: "pedicure", title: "Pedicure", description: "Foot care and nail polish", duration: 45, price: 40, category: "Nails", active: true },
  { id: "gel_nails", title: "Gel Nails", description: "Long-lasting gel polish application", duration: 45, price: 40, category: "Nails", active: true },
  { id: "facial", title: "Facial", description: "Deep cleansing and moisturizing", duration: 60, price: 65, category: "Skin", active: true },
  { id: "chemical_peel", title: "Chemical Peel", description: "Exfoliating skin treatment", duration: 45, price: 95, category: "Skin", active: true },
  { id: "lash_extensions", title: "Lash Extensions", description: "Individual lash application", duration: 90, price: 120, category: "Lashes", active: true },
  { id: "lash_lift", title: "Lash Lift", description: "Semi-permanent lash curling", duration: 60, price: 75, category: "Lashes", active: true },
  { id: "waxing", title: "Waxing", description: "Full body or facial waxing", duration: 30, price: 30, category: "Skin", active: true },
  { id: "makeup", title: "Makeup Application", description: "Professional makeup for any occasion", duration: 60, price: 75, category: "Makeup", active: true },
];

export const DEFAULT_PORTFOLIO: PortfolioData[] = [
  { id: "p1", caption: "Beautiful balayage transformation", serviceCategory: "Hair", tags: ["color", "balayage"] },
  { id: "p2", caption: "Elegant bridal updo", serviceCategory: "Hair", tags: ["styling", "bridal"] },
  { id: "p3", caption: "Classic French manicure", serviceCategory: "Nails", tags: ["manicure", "french"] },
  { id: "p4", caption: "Gel nails with nail art", serviceCategory: "Nails", tags: ["gel", "nail-art"] },
  { id: "p5", caption: "Relaxing facial treatment", serviceCategory: "Skin", tags: ["facial", "relaxation"] },
  { id: "p6", caption: "Natural lash extensions", serviceCategory: "Lashes", tags: ["extensions", "natural"] },
  { id: "p7", caption: "Bold makeup look", serviceCategory: "Makeup", tags: ["bold", "evening"] },
  { id: "p8", caption: "Subtle everyday makeup", serviceCategory: "Makeup", tags: ["natural", "everyday"] },
  { id: "p9", caption: "Vibrant hair color", serviceCategory: "Hair", tags: ["color", "vibrant"] },
  { id: "p10", caption: "Pedicure with nail art", serviceCategory: "Nails", tags: ["pedicure", "art"] },
];

export async function getServices(store: DataStore): Promise<ServiceData[]> {
  let services = await store.get<ServiceData[]>(SERVICES_KEY);
  if (!services) {
    services = DEFAULT_SERVICES.map((s) => ({ ...s }));
    await store.set(SERVICES_KEY, services);
  }
  return services;
}

export async function getPortfolio(store: DataStore): Promise<PortfolioData[]> {
  let portfolio = await store.get<PortfolioData[]>(PORTFOLIO_KEY);
  if (!portfolio) {
    portfolio = DEFAULT_PORTFOLIO;
    await store.set(PORTFOLIO_KEY, portfolio);
  }
  return portfolio;
}

export async function getReviews(store: DataStore): Promise<ReviewData[]> {
  return (await store.get<ReviewData[]>(REVIEWS_KEY)) ?? [];
}

export async function addReview(store: DataStore, review: ReviewData): Promise<void> {
  const reviews = await getReviews(store);
  reviews.push(review);
  await store.set(REVIEWS_KEY, reviews);
}

export async function updateReview(store: DataStore, reviewId: string, updates: Partial<ReviewData>): Promise<void> {
  const reviews = await getReviews(store);
  const idx = reviews.findIndex(r => r.id === reviewId);
  if (idx >= 0) {
    reviews[idx] = { ...reviews[idx], ...updates };
    await store.set(REVIEWS_KEY, reviews);
  }
}
