import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';

// Deliberately does NOT vi.mock('@supabase/supabase-js'): other spec files
// in this suite import SupabaseService (directly or via TestBed) before
// this file runs, which loads the real '@supabase/supabase-js' module into
// the shared module registry first -- a vi.mock() call here then can't
// retroactively replace the createClient binding that supabase.service.ts
// already closed over from that earlier, unmocked load (confirmed by
// running this file after player.service.spec.ts: the mock factory never
// gets invoked and the real createClient runs anyway). The real
// createClient() call is synchronous and makes no network request, so
// asserting on the real client's own public fields is just as meaningful
// here and doesn't depend on file run order.
describe('SupabaseService', () => {
  const originalUrl = environment.supabaseUrl;
  const originalKey = environment.supabaseAnonKey;

  afterEach(() => {
    (environment as any).supabaseUrl = originalUrl;
    (environment as any).supabaseAnonKey = originalKey;
  });

  it('has a null client and is not configured when the environment has no URL/key (this test environment\'s default)', () => {
    const service = new SupabaseService();
    expect(service.client).toBeNull();
    expect(service.isConfigured).toBe(false);
  });

  it('creates a real client and is configured when both URL and anon key are set', () => {
    (environment as any).supabaseUrl = 'https://example.supabase.co';
    (environment as any).supabaseAnonKey = 'anon-key-123';

    const service = new SupabaseService();

    expect(service.client).not.toBeNull();
    expect((service.client as any).supabaseUrl).toBe('https://example.supabase.co');
    expect((service.client as any).supabaseKey).toBe('anon-key-123');
    expect(service.isConfigured).toBe(true);
  });

  it('stays unconfigured when only the URL is set but the anon key is missing', () => {
    (environment as any).supabaseUrl = 'https://example.supabase.co';
    (environment as any).supabaseAnonKey = '';

    const service = new SupabaseService();

    expect(service.client).toBeNull();
    expect(service.isConfigured).toBe(false);
  });

  it('stays unconfigured when only the anon key is set but the URL is missing', () => {
    (environment as any).supabaseUrl = '';
    (environment as any).supabaseAnonKey = 'anon-key-123';

    const service = new SupabaseService();

    expect(service.client).toBeNull();
    expect(service.isConfigured).toBe(false);
  });
});
