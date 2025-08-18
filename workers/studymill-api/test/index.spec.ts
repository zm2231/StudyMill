import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('StudyMill API Tests', () => {
	describe('API Health Check', () => {
		it('responds with health status', async () => {
			const request = new Request('http://example.com/');
			const response = await SELF.fetch(request);
			const data = await response.json();
			
			expect(response.status).toBe(200);
			expect(data.message).toBe('StudyMill API v1.0');
			expect(data.status).toBeDefined();
		});
	});

	describe('API Routes', () => {
		it('returns 404 for non-existent routes', async () => {
			const request = new Request('http://example.com/nonexistent');
			const response = await SELF.fetch(request);
			const data = await response.json();
			
			expect(response.status).toBe(404);
			expect(data.error).toBe('Not Found');
		});
	});
});
