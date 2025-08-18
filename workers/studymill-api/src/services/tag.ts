import { DatabaseService } from './database';
import { createError } from '../middleware/error';

export interface Tag {
  id: string;
  userId: string;
  name: string;
  parentId?: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagHierarchy extends Tag {
  path: string;
  level: number;
  children?: TagHierarchy[];
}

export interface CreateTagData {
  name: string;
  parentId?: string;
  description?: string;
  color?: string;
}

export interface TagFilters {
  parentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class TagService {
  constructor(private dbService: DatabaseService) {}

  /**
   * Generate a unique ID for tags
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new tag
   */
  async createTag(userId: string, data: CreateTagData): Promise<Tag> {
    // Validate parent exists if provided
    if (data.parentId) {
      const parent = await this.getTag(data.parentId, userId);
      if (!parent) {
        throw createError(400, 'Parent tag not found');
      }
    }

    // Check for duplicate names at the same level
    const existing = await this.findTagByName(userId, data.name, data.parentId);
    if (existing) {
      throw createError(400, 'Tag with this name already exists at this level');
    }

    const tagId = this.generateId();
    const now = new Date().toISOString();

    const tag: Tag = {
      id: tagId,
      userId,
      name: data.name,
      parentId: data.parentId,
      description: data.description,
      color: data.color,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.dbService.execute(
      `INSERT INTO tags (id, user_id, name, parent_id, description, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tag.id,
        tag.userId,
        tag.name,
        tag.parentId,
        tag.description,
        tag.color,
        tag.createdAt,
        tag.updatedAt
      ]
    );

    if (!result.success) {
      throw createError(500, 'Failed to create tag');
    }

    return tag;
  }

  /**
   * Get a specific tag by ID
   */
  async getTag(tagId: string, userId: string): Promise<Tag | null> {
    const result = await this.dbService.queryFirst(
      `SELECT * FROM tags WHERE id = ? AND user_id = ?`,
      [tagId, userId]
    );

    if (!result) return null;

    return this.mapDbRowToTag(result);
  }

  /**
   * Find tag by name and parent
   */
  async findTagByName(userId: string, name: string, parentId?: string): Promise<Tag | null> {
    const result = await this.dbService.queryFirst(
      `SELECT * FROM tags WHERE user_id = ? AND name = ? AND 
       ${parentId ? 'parent_id = ?' : 'parent_id IS NULL'}`,
      parentId ? [userId, name, parentId] : [userId, name]
    );

    if (!result) return null;

    return this.mapDbRowToTag(result);
  }

  /**
   * Get all tags for a user with optional filtering
   */
  async getTags(userId: string, filters: TagFilters = {}): Promise<Tag[]> {
    let query = `SELECT * FROM tags WHERE user_id = ?`;
    const params: any[] = [userId];

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        query += ` AND parent_id IS NULL`;
      } else {
        query += ` AND parent_id = ?`;
        params.push(filters.parentId);
      }
    }

    if (filters.search) {
      query += ` AND (name LIKE ? OR description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY name ASC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(filters.offset);
    }

    const results = await this.dbService.query(query, params);
    return results.map(row => this.mapDbRowToTag(row));
  }

  /**
   * Get tag hierarchy for a user
   */
  async getTagHierarchy(userId: string): Promise<TagHierarchy[]> {
    const results = await this.dbService.query(
      `SELECT * FROM tag_hierarchy WHERE user_id = ? ORDER BY level ASC, name ASC`,
      [userId]
    );

    // Convert flat list to hierarchical structure
    const hierarchyMap = new Map<string, TagHierarchy>();
    const rootTags: TagHierarchy[] = [];

    for (const row of results) {
      const tag: TagHierarchy = {
        ...this.mapDbRowToTag(row),
        path: row.path,
        level: row.level,
        children: []
      };

      hierarchyMap.set(tag.id, tag);

      if (tag.parentId) {
        const parent = hierarchyMap.get(tag.parentId);
        if (parent) {
          parent.children!.push(tag);
        }
      } else {
        rootTags.push(tag);
      }
    }

    return rootTags;
  }

  /**
   * Update a tag
   */
  async updateTag(tagId: string, userId: string, updates: Partial<CreateTagData>): Promise<Tag | null> {
    const existing = await this.getTag(tagId, userId);
    if (!existing) {
      return null;
    }

    // Validate parent exists if provided
    if (updates.parentId) {
      const parent = await this.getTag(updates.parentId, userId);
      if (!parent) {
        throw createError(400, 'Parent tag not found');
      }

      // Prevent circular references
      if (await this.wouldCreateCircularReference(tagId, updates.parentId, userId)) {
        throw createError(400, 'Cannot create circular reference');
      }
    }

    // Check for duplicate names if name is being updated
    if (updates.name && updates.name !== existing.name) {
      const duplicate = await this.findTagByName(userId, updates.name, updates.parentId ?? existing.parentId);
      if (duplicate && duplicate.id !== tagId) {
        throw createError(400, 'Tag with this name already exists at this level');
      }
    }

    const updateFields = [];
    const params = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      params.push(updates.name);
    }

    if (updates.parentId !== undefined) {
      updateFields.push('parent_id = ?');
      params.push(updates.parentId);
    }

    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      params.push(updates.description);
    }

    if (updates.color !== undefined) {
      updateFields.push('color = ?');
      params.push(updates.color);
    }

    if (updateFields.length === 0) {
      return existing; // No updates needed
    }

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(tagId, userId);

    const result = await this.dbService.execute(
      `UPDATE tags SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    if (!result.success) {
      throw createError(500, 'Failed to update tag');
    }

    return this.getTag(tagId, userId);
  }

  /**
   * Delete a tag and all its children
   */
  async deleteTag(tagId: string, userId: string): Promise<boolean> {
    const existing = await this.getTag(tagId, userId);
    if (!existing) {
      return false;
    }

    // Get all child tags to delete them recursively
    const children = await this.getTags(userId, { parentId: tagId });
    
    // Delete all children first
    for (const child of children) {
      await this.deleteTag(child.id, userId);
    }

    // Delete the tag itself
    const result = await this.dbService.execute(
      `DELETE FROM tags WHERE id = ? AND user_id = ?`,
      [tagId, userId]
    );

    return result.success;
  }

  /**
   * Get tags by memory ID
   */
  async getTagsByMemoryId(memoryId: string, userId: string): Promise<Tag[]> {
    const results = await this.dbService.query(
      `SELECT t.* FROM tags t
       JOIN memory_tags mt ON t.id = mt.tag_id
       WHERE mt.memory_id = ? AND t.user_id = ?
       ORDER BY t.name ASC`,
      [memoryId, userId]
    );

    return results.map(row => this.mapDbRowToTag(row));
  }

  /**
   * Add tag to memory
   */
  async addTagToMemory(memoryId: string, tagId: string, userId: string): Promise<boolean> {
    // Verify tag belongs to user
    const tag = await this.getTag(tagId, userId);
    if (!tag) {
      throw createError(404, 'Tag not found');
    }

    // Check if association already exists
    const existing = await this.dbService.queryFirst(
      `SELECT 1 FROM memory_tags WHERE memory_id = ? AND tag_id = ?`,
      [memoryId, tagId]
    );

    if (existing) {
      return true; // Already associated
    }

    const result = await this.dbService.execute(
      `INSERT INTO memory_tags (memory_id, tag_id, created_at) VALUES (?, ?, ?)`,
      [memoryId, tagId, new Date().toISOString()]
    );

    return result.success;
  }

  /**
   * Remove tag from memory
   */
  async removeTagFromMemory(memoryId: string, tagId: string): Promise<boolean> {
    const result = await this.dbService.execute(
      `DELETE FROM memory_tags WHERE memory_id = ? AND tag_id = ?`,
      [memoryId, tagId]
    );

    return result.success;
  }

  /**
   * Check if adding a parent would create a circular reference
   */
  private async wouldCreateCircularReference(tagId: string, parentId: string, userId: string): Promise<boolean> {
    let currentParentId = parentId;
    const visited = new Set<string>();

    while (currentParentId) {
      if (visited.has(currentParentId) || currentParentId === tagId) {
        return true; // Circular reference detected
      }

      visited.add(currentParentId);
      const parent = await this.getTag(currentParentId, userId);
      currentParentId = parent?.parentId;
    }

    return false;
  }

  /**
   * Map database row to Tag object
   */
  private mapDbRowToTag(row: any): Tag {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      parentId: row.parent_id,
      description: row.description,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}