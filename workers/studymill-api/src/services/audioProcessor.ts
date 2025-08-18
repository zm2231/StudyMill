import Groq from 'groq-sdk';

/**
 * Audio transcription service supporting multiple backends:
 * - Groq API (Whisper) - Primary backend, 8-24x faster than alternatives
 * - Local WhisperKit support (future: when available on macOS/iOS)
 * 
 * NOTE: Cloudflare Workers AI was considered but Groq provides:
 * - 8-24x faster processing (216x real-time vs ~10-30x real-time)
 * - Better cost efficiency during growth phase (49% cheaper for <500 hours/month)
 * - Superior performance for lecture transcription use case
 */

export interface AudioTranscriptionOptions {
  language?: string; // ISO-639-1 format (e.g., 'en', 'es', 'fr')
  model?: 'whisper-large-v3' | 'whisper-large-v3-turbo';
  responseFormat?: 'json' | 'text' | 'verbose_json';
  timestampGranularities?: ('word' | 'segment')[];
  temperature?: number; // 0-1, controls randomness
  backend?: 'groq' | 'local' | 'auto';
}

export interface AudioSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordTimestamp[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments: AudioSegment[];
  words?: WordTimestamp[];
  backend: string;
  processingTime: number;
}

export interface TopicSegment {
  startTime: number;
  endTime: number;
  topic: string;
  summary: string;
  keyPoints: string[];
  confidence: number;
}

export interface AudioMemory {
  id: string;
  userId: string;
  sourceFile: string;
  transcription: TranscriptionResult;
  topics: TopicSegment[];
  extractedConcepts: string[];
  metadata: {
    duration: number;
    format: string;
    size: number;
    uploadedAt: string;
    processingBackend: string;
  };
}

export class AudioProcessor {
  private groqClient?: Groq;
  private geminiApiKey?: string;

  constructor(
    private groqApiKey?: string,
    geminiApiKey?: string
  ) {
    if (groqApiKey) {
      this.groqClient = new Groq({
        apiKey: groqApiKey,
      });
    }
    this.geminiApiKey = geminiApiKey;
  }

  /**
   * Main transcription method that automatically selects the best backend
   */
  async transcribeAudio(
    audioBuffer: ArrayBuffer,
    fileName: string,
    options: AudioTranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    // Determine backend to use
    const backend = this.selectTranscriptionBackend(options.backend, audioBuffer.byteLength);
    
    try {
      let result: TranscriptionResult;
      
      switch (backend) {
        case 'groq':
          result = await this.transcribeWithGroq(audioBuffer, fileName, options);
          break;
        case 'local':
          result = await this.transcribeWithLocal(audioBuffer, fileName, options);
          break;
        default:
          throw new Error(`Unsupported transcription backend: ${backend}`);
      }
      
      result.processingTime = Date.now() - startTime;
      result.backend = backend;
      
      return result;
    } catch (error) {
      console.error(`Transcription failed with ${backend} backend:`, error);
      throw error;
    }
  }

  /**
   * Transcribe using Groq API (Whisper)
   */
  private async transcribeWithGroq(
    audioBuffer: ArrayBuffer,
    fileName: string,
    options: AudioTranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (!this.groqClient) {
      throw new Error('Groq API key not configured');
    }

    // Check file size limits (25MB for free tier, 100MB for dev tier)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (audioBuffer.byteLength > maxSize) {
      throw new Error(`Audio file too large: ${audioBuffer.byteLength} bytes (max: ${maxSize})`);
    }

    // Convert ArrayBuffer to File-like object for Groq API
    const audioFile = new File([audioBuffer], fileName, {
      type: this.getAudioMimeType(fileName)
    });

    const transcription = await this.groqClient.audio.transcriptions.create({
      file: audioFile,
      model: options.model || 'whisper-large-v3-turbo',
      response_format: options.responseFormat || 'verbose_json',
      timestamp_granularities: options.timestampGranularities || ['segment'],
      language: options.language,
      temperature: options.temperature || 0.0,
    });

    return this.formatGroqResponse(transcription);
  }


  /**
   * Transcribe using local WhisperKit (placeholder for future implementation)
   * 
   * Future implementation would support:
   * - macOS/iOS WhisperKit integration via native bridge
   * - Local model downloads (distil-whisper, whisper-large-v3)
   * - Offline transcription for privacy-sensitive content
   * - Custom academic vocabulary models
   */
  private async transcribeWithLocal(
    audioBuffer: ArrayBuffer,
    fileName: string,
    options: AudioTranscriptionOptions
  ): Promise<TranscriptionResult> {
    // Future: Interface with WhisperKit via:
    // - Native macOS/iOS app bridge 
    // - Local subprocess execution
    // - WASM-compiled Whisper models
    throw new Error('Local WhisperKit transcription not yet implemented. Use Groq backend.');
  }

  /**
   * Automatically select the best transcription backend
   */
  private selectTranscriptionBackend(
    preferredBackend?: string,
    fileSize?: number
  ): string {
    if (preferredBackend && preferredBackend !== 'auto') {
      return preferredBackend;
    }

    // Auto-selection logic: Always prefer Groq for speed and accuracy
    if (this.groqClient) {
      return 'groq';
    }
    
    throw new Error('No transcription backend available. Configure Groq API key.');
  }

  /**
   * Segment transcription by topics using AI
   */
  async segmentByTopics(
    transcription: TranscriptionResult,
    userId: string
  ): Promise<TopicSegment[]> {
    if (!this.geminiApiKey) {
      console.warn('Gemini API key not configured, using basic time-based segmentation');
      return this.createBasicTimeSegments(transcription);
    }

    try {
      // Use Gemini API for intelligent topic segmentation
      const topicSegments = await this.segmentWithGemini(transcription);
      
      if (topicSegments.length > 0) {
        return topicSegments;
      } else {
        console.warn('Gemini segmentation returned no results, falling back to basic segmentation');
        return this.createBasicTimeSegments(transcription);
      }
    } catch (error) {
      console.error('Gemini topic segmentation failed:', error);
      console.log('Falling back to basic time-based segmentation');
      return this.createBasicTimeSegments(transcription);
    }
  }

  /**
   * Use Gemini API for intelligent topic segmentation
   */
  private async segmentWithGemini(transcription: TranscriptionResult): Promise<TopicSegment[]> {
    // Prepare the transcript with timestamps for analysis
    const timestampedText = transcription.segments.map(s => 
      `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`
    ).join('\n');

    const prompt = `You are an AI specialist in educational content analysis with expertise in lecture segmentation and academic discourse patterns. Your task is to intelligently segment this transcript into coherent topic boundaries using advanced reasoning about content flow and educational structure.

TRANSCRIPT WITH TIMESTAMPS:
${timestampedText}

ANALYSIS FRAMEWORK:
1. **Content Flow Analysis**: Identify natural discourse markers, conceptual transitions, and pedagogical shifts
2. **Temporal Optimization**: Create 3-8 segments of 2-10 minutes each, avoiding fragmentation
3. **Semantic Coherence**: Ensure each segment represents a unified concept or learning objective
4. **Educational Structure**: Recognize patterns like introduction→explanation→examples→conclusion
5. **Transition Recognition**: Detect explicit ("Let's move to...") and implicit (concept shifts) boundaries

QUALITY CRITERIA:
- Topic names should be specific and academically precise
- Summaries must capture the learning objective and core concept
- Key points should represent actionable knowledge elements
- Confidence scores should reflect boundary clarity and content coherence

REASONING PROCESS:
1. First, identify major conceptual shifts and explicit transitions
2. Evaluate content density and complexity to determine optimal boundaries
3. Ensure each segment has sufficient content for meaningful learning
4. Validate that segments follow logical educational progression
5. Assign confidence based on transition clarity and content unity

OUTPUT FORMAT (Valid JSON only):
[
  {
    "startTime": 0.0,
    "endTime": 245.3,
    "topic": "Introduction to Machine Learning Fundamentals",
    "summary": "Comprehensive overview of machine learning paradigms, introducing supervised and unsupervised learning with foundational concepts.",
    "keyPoints": ["Supervised vs unsupervised learning paradigms", "Training and validation data principles", "Model evaluation and performance metrics", "Real-world ML applications"],
    "confidence": 0.92
  }
]

Provide only the JSON array. No explanatory text or markdown formatting.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1, // Low temperature for consistent, focused analysis
            topK: 32,          // Optimized for Gemini 2.5 Flash
            topP: 0.9,         // Slightly more focused than 0.95
            maxOutputTokens: 4096, // Increased for detailed topic analysis
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        throw new Error('No content generated by Gemini API');
      }

      // Parse the JSON response
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from Gemini response');
      }

      const topicSegments: TopicSegment[] = JSON.parse(jsonMatch[0]);
      
      // Validate and clean the segments
      return this.validateAndCleanSegments(topicSegments, transcription);
      
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  }

  /**
   * Validate and clean topic segments from AI
   */
  private validateAndCleanSegments(segments: TopicSegment[], transcription: TranscriptionResult): TopicSegment[] {
    const maxDuration = transcription.duration || transcription.segments[transcription.segments.length - 1]?.end || 3600;
    
    return segments
      .filter(segment => {
        // Basic validation
        return (
          segment.startTime >= 0 &&
          segment.endTime > segment.startTime &&
          segment.endTime <= maxDuration + 10 && // Allow small buffer
          segment.topic?.trim() &&
          segment.summary?.trim() &&
          Array.isArray(segment.keyPoints) &&
          segment.keyPoints.length > 0 &&
          typeof segment.confidence === 'number' &&
          segment.confidence >= 0 &&
          segment.confidence <= 1
        );
      })
      .map(segment => ({
        ...segment,
        topic: segment.topic.trim(),
        summary: segment.summary.trim(),
        keyPoints: segment.keyPoints.filter(point => point?.trim()).map(point => point.trim()),
        confidence: Math.max(0, Math.min(1, segment.confidence)) // Clamp to [0,1]
      }))
      .sort((a, b) => a.startTime - b.startTime); // Sort by start time
  }

  /**
   * Fallback: Create basic time-based segments when AI segmentation fails
   */
  private createBasicTimeSegments(transcription: TranscriptionResult): TopicSegment[] {
    const segments = transcription.segments;
    const topicSegments: TopicSegment[] = [];
    
    // Group segments by time intervals (5-minute chunks)
    const chunkDuration = 300; // 5 minutes
    let currentChunk: AudioSegment[] = [];
    let chunkStartTime = 0;

    for (const segment of segments) {
      if (segment.start - chunkStartTime > chunkDuration && currentChunk.length > 0) {
        // Process current chunk
        const chunkText = currentChunk.map(s => s.text).join(' ');
        topicSegments.push({
          startTime: chunkStartTime,
          endTime: currentChunk[currentChunk.length - 1].end,
          topic: this.extractTopicFromText(chunkText),
          summary: this.summarizeText(chunkText),
          keyPoints: this.extractKeyPoints(chunkText),
          confidence: 0.6 // Lower confidence for basic segmentation
        });
        
        // Start new chunk
        currentChunk = [segment];
        chunkStartTime = segment.start;
      } else {
        currentChunk.push(segment);
      }
    }

    // Process final chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.map(s => s.text).join(' ');
      topicSegments.push({
        startTime: chunkStartTime,
        endTime: currentChunk[currentChunk.length - 1].end,
        topic: this.extractTopicFromText(chunkText),
        summary: this.summarizeText(chunkText),
        keyPoints: this.extractKeyPoints(chunkText),
        confidence: 0.6
      });
    }

    return topicSegments;
  }

  /**
   * Create memories from audio transcription with timestamp alignment
   * This is a simplified interface - actual memory creation should use MemoryService
   */
  async createMemoriesFromAudio(
    transcription: TranscriptionResult,
    topicSegments: TopicSegment[],
    audioFileId: string,
    userId: string
  ): Promise<AudioMemory> {
    const audioMemory: AudioMemory = {
      id: crypto.randomUUID(),
      userId,
      sourceFile: audioFileId,
      transcription,
      topics: topicSegments,
      extractedConcepts: this.extractConcepts(transcription.text),
      metadata: {
        duration: transcription.duration,
        format: 'unknown', // Would be detected from file header
        size: 0, // Would be passed from upload
        uploadedAt: new Date().toISOString(),
        processingBackend: transcription.backend
      }
    };

    return audioMemory;
  }

  /**
   * Helper method to create proper Memory objects via MemoryService
   * Call this from the API route with a proper MemoryService instance
   */
  static async createMemoriesWithMemoryService(
    memoryService: any, // MemoryService
    transcription: TranscriptionResult,
    topicSegments: TopicSegment[],
    audioFileId: string,
    userId: string,
    containerTags: string[] = []
  ): Promise<any[]> {
    return await memoryService.importFromAudioTranscription(
      transcription,
      topicSegments,
      audioFileId,
      userId,
      containerTags
    );
  }

  /**
   * Helper methods
   */
  private getAudioMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'flac': 'audio/flac',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
    };
    return mimeTypes[extension || ''] || 'audio/mpeg';
  }

  private formatGroqResponse(response: any): TranscriptionResult {
    return {
      text: response.text,
      language: response.language || 'unknown',
      duration: response.duration || 0,
      segments: response.segments?.map((seg: any, index: number) => ({
        id: index,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        words: seg.words
      })) || [],
      words: response.words || [],
      backend: 'groq',
      processingTime: 0, // Will be set by caller
    };
  }


  private extractTopicFromText(text: string): string {
    // Simple topic extraction - in production, use AI
    const words = text.toLowerCase().split(' ');
    const topicWords = words.filter(word => 
      word.length > 5 && 
      !['this', 'that', 'with', 'have', 'will', 'would', 'could', 'should'].includes(word)
    );
    return topicWords[0] || 'General Discussion';
  }

  private summarizeText(text: string): string {
    // Simple summarization - first sentence or first 100 chars
    const sentences = text.split(/[.!?]+/);
    return sentences[0]?.trim() || text.substring(0, 100) + '...';
  }

  private extractKeyPoints(text: string): string[] {
    // Simple key point extraction
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  private extractConcepts(text: string): string[] {
    // Simple concept extraction - in production, use NLP
    const words = text.toLowerCase().split(/\W+/);
    const concepts = words.filter(word => 
      word.length > 6 && 
      !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'have', 'will', 'would', 'could', 'should', 'this', 'that', 'with', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time'].includes(word)
    );
    
    // Remove duplicates and return top 10
    return [...new Set(concepts)].slice(0, 10);
  }
}

/**
 * Factory function to create AudioProcessor with environment configuration
 */
export function createAudioProcessor(env: any): AudioProcessor {
  return new AudioProcessor(
    env.GROQ_API_KEY,
    env.GEMINI_API_KEY
  );
}