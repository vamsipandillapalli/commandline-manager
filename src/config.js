
import { withStore } from './store.js';

export async function getConfig(key) {
  return withStore(db => db.config[key] ?? null);
}

export async function setConfig(key, value) {
  return withStore(db => { db.config[key] = String(value); });
}

export async function listConfig() {
  return withStore(db => Object.entries(db.config).map(([key,value])=>({key,value})));
}
