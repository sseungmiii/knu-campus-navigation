'use client';
import {createBrowserClient} from '@supabase/ssr';
export function createClient(config) { return createBrowserClient(config.url, config.key); }
