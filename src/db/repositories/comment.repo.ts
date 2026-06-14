import { v4 as uuid } from 'uuid'
import { db } from '../index'
import type { CaseComment, CreateCommentInput } from '../../domain/case.types'

const now = () => new Date().toISOString()

function deserialize(row: Record<string, unknown>): CaseComment {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    orgId: row.org_id as string,
    body: row.body as string,
    authorId: row.author_id as string | undefined,
    authorName: row.author_name as string | undefined,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export const commentRepo = {
  create(caseId: string, orgId: string, input: CreateCommentInput): CaseComment {
    const id = uuid()
    const ts = now()

    db.prepare(`
      INSERT INTO comments (id, case_id, org_id, body, author_id, author_name, is_public, created_at, updated_at)
      VALUES (@id, @caseId, @orgId, @body, @authorId, @authorName, @isPublic, @ts, @ts)
    `).run({
      id,
      caseId,
      orgId,
      body: input.body,
      authorId: input.authorId ?? null,
      authorName: input.authorName ?? null,
      isPublic: input.isPublic !== false ? 1 : 0,
      ts,
    })

    return this.findById(id)!
  },

  findById(id: string): CaseComment | null {
    const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? deserialize(row) : null
  },

  findByCaseId(caseId: string, orgId: string): CaseComment[] {
    const rows = db
      .prepare('SELECT * FROM comments WHERE case_id = ? AND org_id = ? ORDER BY created_at ASC')
      .all(caseId, orgId) as Record<string, unknown>[]
    return rows.map(deserialize)
  },
}
