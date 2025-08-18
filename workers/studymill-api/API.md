# StudyMill API Documentation v2.0

## Overview

StudyMill API v2.0 introduces a memory-first architecture that enables intelligent knowledge management for students. The API supports creating, organizing, and retrieving memories from multiple sources including documents, web pages, conversations, and manual input.

## Base URL

- **Development**: `http://localhost:8787`
- **Production**: `https://api.studymill.ai`

## Authentication

All API endpoints (except health check) require authentication using Bearer tokens.

```http
Authorization: Bearer <jwt_token>
```

Get tokens via `/auth/login` or `/auth/register` endpoints.

## Memory Architecture

### Core Concepts

- **Memory**: A discrete piece of knowledge with content, source information, and metadata
- **Memory Chunks**: Subdivisions of memories optimized for vector search and retrieval
- **Container Tags**: Organizational labels for grouping related memories (e.g., course names, topics)
- **Source Types**: Origin classification (document, web, conversation, manual, audio)
- **User Partitioning**: All memories are strictly isolated by user for privacy and security

## API Endpoints

### Health Check

#### GET /
Get API health status and version information.

**Response:**
```json
{
  "message": "StudyMill API v1.0",
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "database": "healthy"
  }
}
```

---

## Memory Management

### Create Memory

#### POST /api/v1/memories

Create a new memory with content and metadata.

**Request Body:**
```json
{
  "content": "Quantum computing uses quantum mechanics principles...",
  "source_type": "manual",
  "source_id": "optional-source-reference",
  "container_tags": ["physics", "quantum-computing"],
  "metadata": {
    "topic": "quantum computing",
    "importance": "high"
  }
}
```

**Response (201):**
```json
{
  "memory": {
    "id": "mem_123456",
    "userId": "user_789",
    "content": "Quantum computing uses quantum mechanics principles...",
    "sourceType": "manual",
    "sourceId": null,
    "containerTags": ["physics", "quantum-computing"],
    "metadata": {
      "topic": "quantum computing",
      "importance": "high"
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### Get Memory

#### GET /api/v1/memories/{id}

Retrieve a specific memory by ID (user-scoped).

**Response (200):**
```json
{
  "memory": {
    "id": "mem_123456",
    "userId": "user_789",
    "content": "Memory content...",
    "sourceType": "document",
    "containerTags": ["course-cs101"],
    "metadata": {},
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### List Memories

#### GET /api/v1/memories

Get all memories for the authenticated user with optional filtering.

**Query Parameters:**
- `source_type` (optional): Filter by source type
- `container_tags` (optional): Comma-separated list of tags to filter by
- `limit` (optional): Maximum number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Example:**
```
GET /api/v1/memories?source_type=document&container_tags=physics,quantum&limit=20
```

**Response (200):**
```json
{
  "memories": [
    {
      "id": "mem_123456",
      "content": "Memory content...",
      "sourceType": "document",
      "containerTags": ["physics", "quantum"],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### Update Memory

#### PUT /api/v1/memories/{id}

Update an existing memory (user-scoped).

**Request Body:**
```json
{
  "content": "Updated memory content...",
  "container_tags": ["updated-tag"],
  "metadata": {
    "updated": true
  }
}
```

**Response (200):**
```json
{
  "memory": {
    "id": "mem_123456",
    "content": "Updated memory content...",
    "containerTags": ["updated-tag"],
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

### Delete Memory

#### DELETE /api/v1/memories/{id}

Delete a memory and all associated chunks/embeddings (user-scoped).

**Response (200):**
```json
{
  "success": true
}
```

---

## Memory Search

### Search Memories

#### POST /api/v1/memories/search

Search memories using semantic and keyword search.

**Request Body:**
```json
{
  "query": "quantum computing basics",
  "filters": {
    "source_type": "document",
    "container_tags": ["physics"]
  },
  "limit": 10
}
```

**Response (200):**
```json
{
  "results": [
    {
      "id": "mem_123456",
      "score": 0.89,
      "content": "Quantum computing uses quantum mechanics...",
      "sourceType": "document",
      "containerTags": ["physics", "quantum"],
      "metadata": {
        "pageNumber": 15
      }
    }
  ],
  "query": "quantum computing basics",
  "filters": {
    "source_type": "document"
  }
}
```

---

## Memory Import

### Import from Document

#### POST /api/v1/memories/import/document

Import memories from an existing document by converting document chunks to memories.

**Request Body:**
```json
{
  "document_id": "doc_123456",
  "container_tags": ["course-cs101", "lecture-notes"]
}
```

**Response (200):**
```json
{
  "memories": [
    {
      "id": "mem_123456",
      "content": "Content from document chunk 1...",
      "sourceType": "document",
      "sourceId": "doc_123456",
      "containerTags": ["course-cs101", "lecture-notes"]
    }
  ],
  "imported": 5
}
```

---

## Memory Relations

### Get Memory Relations

#### GET /api/v1/memories/{id}/relations

Get related memories for a specific memory.

**Query Parameters:**
- `limit` (optional): Maximum number of relations (default: 10)

**Response (200):**
```json
{
  "relations": [
    {
      "id": "rel_123456",
      "memoryAId": "mem_123456",
      "memoryBId": "mem_789012",
      "relationType": "similar",
      "strength": 0.85,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## Authentication Endpoints

### Register

#### POST /auth/register

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

### Login

#### POST /auth/login

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message",
  "details": "Additional error details",
  "status": 400
}
```

### Common Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request - Invalid input data
- **401**: Unauthorized - Missing or invalid authentication
- **403**: Forbidden - Access denied
- **404**: Not Found - Resource does not exist or not accessible
- **500**: Internal Server Error

## Rate Limiting

- **Authentication endpoints**: 5 requests per minute per IP
- **Memory operations**: 100 requests per minute per user
- **Search operations**: 50 requests per minute per user

## Security Features

### User Data Isolation
- All memories are strictly partitioned by user ID
- Vector searches are filtered by user ID at the database level
- No cross-user data access is possible

### Authentication
- JWT tokens with configurable expiration
- Secure password hashing using bcrypt
- Session management with token refresh

### Input Validation
- All request bodies are validated against schemas
- SQL injection protection through parameterized queries
- XSS protection through input sanitization

## Memory Source Types

- **manual**: User-created content
- **document**: Imported from uploaded documents (PDF, DOCX, etc.)
- **web**: Imported from web pages
- **conversation**: Extracted from AI chat sessions
- **audio**: Transcribed from audio files

## Container Tags

Container tags provide flexible organization:
- Course identifiers: `course-cs101`, `course-physics`
- Topics: `quantum-computing`, `machine-learning`
- Assignment types: `midterm`, `final-project`
- Custom categories: `important`, `review-needed`

## Memory Relations

Memories can be related through:
- **similar**: Semantically similar content
- **contradicts**: Conflicting information
- **builds_on**: Extends or elaborates on another memory
- **references**: Cites or mentions another memory

## Development Notes

### Environment Variables
```env
JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=your-gemini-key
FRONTEND_URL=http://localhost:3000
```

### Database Migration
Run the memory architecture migration:
```bash
npx wrangler d1 execute studymill-db --file=migration-memory-architecture.sql
```

### Testing
```bash
npm test
```

---

*API Documentation v2.0 - Updated for memory-first architecture*