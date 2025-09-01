import { VectorService } from './vector';
import { DatabaseService } from './database';

export type RetrievalMode = 'basic' | 'advanced';

export interface HybridSearchParams {
  query: string;
  userId: string;
  courseId?: string; // optional filter
  limit?: number; // default 5
  mode?: RetrievalMode; // basic = dense only, advanced = dense + bm25 fused
  threshold?: number; // optional score threshold to filter weak results
}

export interface HybridSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: {
    source: string; // document title or identifier for citation in UI
    document_id: string;
    course_id?: string;
    page_number?: number | null;
    chunk_index?: number;
    kind: 'dense' | 'bm25' | 'fused';
  };
}

export class HybridSearchService {
  private static readonly DEFAULT_LIMIT = 5;
  private static readonly RRF_K = 60;

  constructor(
    private vectorService: VectorService,
    private db: DatabaseService
  ) {}

  async hybridSearch(params: HybridSearchParams): Promise<HybridSearchResult[]> {
    const { query, userId, courseId, limit = HybridSearchService.DEFAULT_LIMIT, mode = 'advanced', threshold } = params;

    if (!query || !query.trim()) return [];

    if (mode === 'basic') {
      const dense = await this.semanticOnly(query, userId, courseId, limit);
      return this.applyThreshold(dense, threshold);
    }

    // advanced: fuse dense + bm25
    const [dense, bm25] = await Promise.all([
      this.semanticOnly(query, userId, courseId, Math.max(limit, 10)),
      this.keywordOnly(query, userId, courseId, Math.max(limit, 10))
    ]);

    const fused = this.rrfFuse(dense, bm25, limit);
    return this.applyThreshold(fused, threshold);
  }

  private async semanticOnly(query: string, userId: string, courseId: string | undefined, topK: number): Promise<HybridSearchResult[]> {
    const qvec = await this.vectorService.generateQueryEmbedding(query);

    // Build vector filter: enforce user partition via join condition later; Vectorize filter supports user_id if present in metadata.
    const filter: Record<string, any> = {};
    if (courseId) filter.course_id = { "\$eq": courseId };
    // NOTE: user_id is not guaranteed in Vectorize metadata; enforce partitioning via D1 join below

    const matches = await this.vectorService.searchVectors(qvec, {
      topK: topK,
      filter,
      includeMetadata: true
    });

    if (matches.length === 0) return [];
    const ids = matches.map(m => m.id);

    // Pull full text and doc title for these ids
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.db.query(
      `SELECT e.id, e.document_id, e.course_id, e.page_number, e.chunk_index, e.chunk_text, d.title AS document_title
       FROM document_embeddings e
       LEFT JOIN documents d ON d.id = e.document_id
       WHERE e.id IN (${placeholders}) AND EXISTS (
         SELECT 1 FROM documents dd JOIN courses c ON dd.course_id = c.id
         WHERE dd.id = e.document_id AND c.user_id = ?
       )`,
      [...ids, userId]
    );
    const byId = new Map(rows.map((r: any) => [r.id, r]));

    return matches
      .map(m => {
        const r = byId.get(m.id);
        if (!r) return null;
        return {
          id: m.id,
          score: m.score,
          content: r.chunk_text,
          metadata: {
            source: r.document_title || r.document_id,
            document_id: r.document_id,
            course_id: r.course_id,
            page_number: r.page_number,
            chunk_index: r.chunk_index,
            kind: 'dense' as const,
          }
        } as HybridSearchResult;
      })
      .filter(Boolean) as HybridSearchResult[];
  }

  private sanitizeFTS(query: string): string {
    const sanitized = query
      .replace(/["']/g, '')
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');
    return `"${sanitized}"`;
  }

  private async keywordOnly(query: string, userId: string, courseId: string | undefined, limit: number): Promise<HybridSearchResult[]> {
    const fts = this.sanitizeFTS(query);

    // Use FTS5 with bm25 ranking; enforce user partition through join to documents -> courses
    const sql = `
      SELECT e.id, e.document_id, e.course_id, e.page_number, e.chunk_index, e.chunk_text, d.title AS document_title,
             bm25(embeddings_fts) AS bm25
      FROM embeddings_fts
      JOIN document_embeddings e ON e.rowid = embeddings_fts.rowid
      JOIN documents d ON d.id = e.document_id
      JOIN courses c ON c.id = d.course_id
      WHERE embeddings_fts MATCH ? AND c.user_id = ?
      ${courseId ? 'AND e.course_id = ?' : ''}
      ORDER BY bm25 ASC
      LIMIT ?`;

    const bind = courseId ? [fts, userId, courseId, limit] : [fts, userId, limit];
    const results = await this.db.query(sql, bind);

    // Convert bm25 (lower is better) to a normalized score in (0,1]; use 1/(k+rankIndex) fallback if bm25 missing
    return results.map((r: any, idx: number) => {
      const bm25Score = typeof r.bm25 === 'number' ? r.bm25 : (idx + 1);
      // Rough normalization: invert and clamp
      const score = 1 / (1 + bm25Score);
      return {
        id: r.id,
        score,
        content: r.chunk_text,
        metadata: {
          source: r.document_title || r.document_id,
          document_id: r.document_id,
          course_id: r.course_id,
          page_number: r.page_number,
          chunk_index: r.chunk_index,
          kind: 'bm25' as const,
        }
      } as HybridSearchResult;
    });
  }

  private rrfFuse(dense: HybridSearchResult[], bm25: HybridSearchResult[], limit: number): HybridSearchResult[] {
    const rankDense = new Map(dense.map((r, i) => [r.id, i + 1]));
    const rankBM25 = new Map(bm25.map((r, i) => [r.id, i + 1]));

    const ids = new Set<string>([...rankDense.keys(), ...rankBM25.keys()]);

    const byIdDense = new Map(dense.map(r => [r.id, r]));
    const byIdBM25 = new Map(bm25.map(r => [r.id, r]));

    const fused: HybridSearchResult[] = [];
    ids.forEach(id => {
      const rd = rankDense.get(id);
      const rb = rankBM25.get(id);
      const score = (rd ? 1 / (HybridSearchService.RRF_K + rd) : 0) + (rb ? 1 / (HybridSearchService.RRF_K + rb) : 0);
      const base = byIdDense.get(id) || byIdBM25.get(id);
      if (base) {
        fused.push({
          ...base,
          score,
          metadata: { ...base.metadata, kind: 'fused' }
        });
      }
    });

    fused.sort((a, b) => b.score - a.score);
    return fused.slice(0, limit);
  }

  private applyThreshold(results: HybridSearchResult[], threshold?: number): HybridSearchResult[] {
    if (!threshold) return results;
    return results.filter(r => r.score >= threshold);
  }
}

