import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[QA Control] Supabase env vars missing.\n' +
    'Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'See .env.example for reference.'
  );
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? ''
);

const QUERY_TIMEOUT_MS = 4000;

// Wraps a Supabase query with a hard timeout and timing logs.
// Prevents indefinite loading when Supabase project is cold/paused or env vars are wrong.
export function fetchWithTimeout(query, label) {
  const t0 = performance.now();
  console.log(`[${label}] fetch start`);

  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      const ms = Math.round(performance.now() - t0);
      console.error(`[${label}] timed out after ${ms}ms — possible cold start or invalid env`);
      resolve({ data: null, error: new Error(`timeout after ${ms}ms`) });
    }, QUERY_TIMEOUT_MS);
  });

  return Promise.race([query, timeoutPromise])
    .then((result) => {
      clearTimeout(timer);
      const ms = Math.round(performance.now() - t0);
      if (result.error) {
        console.error(`[${label}] error after ${ms}ms:`, result.error);
      } else {
        console.log(`[${label}] ok in ${ms}ms, rows: ${result.data?.length ?? 0}`);
      }
      return result;
    })
    .catch((err) => {
      clearTimeout(timer);
      const ms = Math.round(performance.now() - t0);
      console.error(`[${label}] rejected after ${ms}ms:`, err);
      return { data: null, error: err };
    });
}
