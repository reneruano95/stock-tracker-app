'use server';

import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Watchlist item type
export interface WatchlistItem {
  symbol: string;
  company: string;
  addedAt: string;
}

// Read watchlist from file
export async function getWatchlist(): Promise<WatchlistItem[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(WATCHLIST_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save watchlist to file
export async function saveWatchlist(watchlist: WatchlistItem[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(WATCHLIST_FILE, JSON.stringify(watchlist, null, 2));
}

// Add item to watchlist
export async function addToWatchlist(symbol: string, company: string): Promise<boolean> {
  const watchlist = await getWatchlist();
  const exists = watchlist.some(item => item.symbol.toUpperCase() === symbol.toUpperCase());
  
  if (exists) return false;
  
  watchlist.push({
    symbol: symbol.toUpperCase(),
    company,
    addedAt: new Date().toISOString(),
  });
  
  await saveWatchlist(watchlist);
  return true;
}

// Remove item from watchlist
export async function removeFromWatchlist(symbol: string): Promise<boolean> {
  const watchlist = await getWatchlist();
  const filtered = watchlist.filter(item => item.symbol.toUpperCase() !== symbol.toUpperCase());
  
  if (filtered.length === watchlist.length) return false;
  
  await saveWatchlist(filtered);
  return true;
}

// Check if symbol is in watchlist
export async function isInWatchlist(symbol: string): Promise<boolean> {
  const watchlist = await getWatchlist();
  return watchlist.some(item => item.symbol.toUpperCase() === symbol.toUpperCase());
}

// Get all watchlist symbols
export async function getWatchlistSymbols(): Promise<string[]> {
  const watchlist = await getWatchlist();
  return watchlist.map(item => item.symbol);
}
