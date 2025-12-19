import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

/**
 * Load state from JSON file
 */
export function loadState(statePath) {
  if (!statePath || !existsSync(statePath)) {
    return {};
  }
  
  try {
    const content = readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading state from ${statePath}:`, error.message);
    return {};
  }
}

/**
 * Save state to JSON file
 */
export function saveState(statePath, state) {
  if (!statePath) return;
  
  try {
    // Ensure directory exists
    const dir = dirname(statePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error saving state to ${statePath}:`, error.message);
  }
}

/**
 * Update specific state values
 */
export function updateState(statePath, updates) {
  const state = loadState(statePath);
  const newState = { ...state, ...updates };
  saveState(statePath, newState);
  return newState;
}

/**
 * Merge state with widget results
 */
export function mergeWidgetResults(state, widgetResults) {
  return {
    ...state,
    ...widgetResults
  };
}
