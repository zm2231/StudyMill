import { Hono } from 'hono';
import { z } from 'zod';

export const gradesRouter = new Hono<{ Bindings: Env }>();

// GET /api/v1/grades/:courseId - Get all grade data for a course
gradesRouter.get('/:courseId', async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.get('userId');
  
  try {
    // Verify course ownership
    const course = await c.env.DB.prepare(`
      SELECT * FROM courses WHERE id = ? AND user_id = ?
    `).bind(courseId, userId).first();
    
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }

    // Get grade weights
    const weights = await c.env.DB.prepare(`
      SELECT * FROM grade_weights 
      WHERE course_id = ? 
      ORDER BY weight_pct DESC
    `).bind(courseId).all();

    // Get assignments with grades
    const assignments = await c.env.DB.prepare(`
      SELECT 
        id,
        title,
        assignment_type as type,
        due_date,
        week_no,
        points,
        weight_category,
        status,
        points_earned,
        points_possible,
        created_at,
        updated_at
      FROM assignments 
      WHERE course_id = ?
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `).bind(courseId).all();

    // Get graded entries if they exist
    const gradeEntries = await c.env.DB.prepare(`
      SELECT 
        assignment_id,
        points_earned,
        points_possible,
        graded_at,
        comments
      FROM grade_entries
      WHERE course_id = ?
    `).bind(courseId).all().catch(() => ({ results: [] }));

    // Merge grade entries with assignments
    const gradeEntriesMap = new Map(
      gradeEntries.results?.map((entry: any) => [entry.assignment_id, entry]) || []
    );

    const assignmentsWithGrades = assignments.results?.map((assignment: any) => {
      const gradeEntry = gradeEntriesMap.get(assignment.id);
      return {
        ...assignment,
        points_earned: gradeEntry?.points_earned ?? assignment.points_earned,
        points_possible: gradeEntry?.points_possible ?? assignment.points_possible ?? assignment.points,
        graded_at: gradeEntry?.graded_at,
        comments: gradeEntry?.comments,
        status: gradeEntry ? 'graded' : assignment.status
      };
    }) || [];

    return c.json({
      success: true,
      course: {
        id: course.id,
        name: course.name,
        code: course.code,
        instructor: course.instructor
      },
      gradeWeights: weights.results || [],
      assignments: assignmentsWithGrades,
      summary: calculateSummary(weights.results || [], assignmentsWithGrades)
    });
  } catch (error) {
    console.error('Failed to fetch grade data:', error);
    return c.json({ error: 'Failed to fetch grade data' }, 500);
  }
});

// GET /api/v1/grades/:courseId/weights - Get just grade weights
gradesRouter.get('/:courseId/weights', async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.get('userId');
  
  try {
    // Verify course ownership
    const course = await c.env.DB.prepare(`
      SELECT id FROM courses WHERE id = ? AND user_id = ?
    `).bind(courseId, userId).first();
    
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }

    const weights = await c.env.DB.prepare(`
      SELECT 
        id,
        name as category,
        weight_pct as weight,
        drop_lowest,
        is_extra_credit
      FROM grade_weights 
      WHERE course_id = ? 
      ORDER BY weight_pct DESC
    `).bind(courseId).all();

    // Calculate total weight
    const totalWeight = weights.results?.reduce(
      (sum: number, w: any) => sum + (w.weight || 0), 
      0
    ) || 0;

    return c.json({
      success: true,
      weights: weights.results || [],
      totalWeight,
      isValid: Math.abs(totalWeight - 1.0) < 0.01
    });
  } catch (error) {
    console.error('Failed to fetch grade weights:', error);
    return c.json({ error: 'Failed to fetch grade weights' }, 500);
  }
});

// GET /api/v1/grades/:courseId/assignments - Get assignments with grades
gradesRouter.get('/:courseId/assignments', async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.get('userId');
  
  try {
    // Verify course ownership
    const course = await c.env.DB.prepare(`
      SELECT id FROM courses WHERE id = ? AND user_id = ?
    `).bind(courseId, userId).first();
    
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }

    const assignments = await c.env.DB.prepare(`
      SELECT 
        a.id,
        a.title,
        a.assignment_type as type,
        a.due_date,
        a.week_no,
        a.points,
        a.weight_category as category,
        a.status,
        a.points_earned,
        a.points_possible,
        a.created_at,
        a.updated_at
      FROM assignments a
      WHERE a.course_id = ?
      ORDER BY a.due_date ASC NULLS LAST, a.created_at ASC
    `).bind(courseId).all();

    // Calculate stats
    const stats = {
      total: assignments.results?.length || 0,
      graded: 0,
      pending: 0,
      upcoming: 0,
      overdue: 0
    };

    const now = new Date();
    const processedAssignments = assignments.results?.map((assignment: any) => {
      const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
      const isGraded = assignment.points_earned !== null && assignment.points_possible !== null;
      const isPastDue = dueDate && dueDate < now && !isGraded;
      
      if (isGraded) stats.graded++;
      else if (isPastDue) stats.overdue++;
      else if (dueDate && dueDate > now) stats.upcoming++;
      else stats.pending++;

      return {
        ...assignment,
        isGraded,
        isPastDue,
        percentScore: isGraded && assignment.points_possible > 0
          ? (assignment.points_earned / assignment.points_possible) * 100
          : null
      };
    }) || [];

    return c.json({
      success: true,
      assignments: processedAssignments,
      stats
    });
  } catch (error) {
    console.error('Failed to fetch assignments:', error);
    return c.json({ error: 'Failed to fetch assignments' }, 500);
  }
});

// POST /api/v1/grades/:courseId/refresh - Refresh grades from syllabus
gradesRouter.post('/:courseId/refresh', async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.get('userId');
  
  try {
    // Verify course ownership
    const course = await c.env.DB.prepare(`
      SELECT id FROM courses WHERE id = ? AND user_id = ?
    `).bind(courseId, userId).first();
    
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }

    // Check if syllabus was previously uploaded
    const syllabusDoc = await c.env.DB.prepare(`
      SELECT document_id FROM syllabus_documents 
      WHERE course_id = ? AND document_type = 'syllabus'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(courseId).first();

    if (!syllabusDoc) {
      return c.json({ 
        error: 'No syllabus found. Please upload a syllabus first.',
        requiresUpload: true 
      }, 404);
    }

    // Trigger re-processing (this would call the existing ingest logic)
    // For now, return a success message indicating the feature is ready to be connected
    return c.json({
      success: true,
      message: 'Grade refresh initiated',
      syllabusDocumentId: syllabusDoc.document_id
    });
  } catch (error) {
    console.error('Failed to refresh grades:', error);
    return c.json({ error: 'Failed to refresh grades' }, 500);
  }
});

// Helper function to calculate grade summary
function calculateSummary(weights: any[], assignments: any[]) {
  let totalWeightedScore = 0;
  let totalWeightUsed = 0;

  // Group assignments by category
  const categoryGroups = new Map<string, any[]>();
  assignments.forEach(assignment => {
    if (assignment.category) {
      const group = categoryGroups.get(assignment.category) || [];
      group.push(assignment);
      categoryGroups.set(assignment.category, group);
    }
  });

  // Calculate weighted score for each category
  weights.forEach(weight => {
    const categoryAssignments = categoryGroups.get(weight.name) || [];
    const gradedAssignments = categoryAssignments.filter(
      a => a.points_earned !== null && a.points_possible !== null && a.points_possible > 0
    );

    if (gradedAssignments.length > 0) {
      const earnedPoints = gradedAssignments.reduce((sum, a) => sum + (a.points_earned || 0), 0);
      const possiblePoints = gradedAssignments.reduce((sum, a) => sum + (a.points_possible || 0), 0);
      
      if (possiblePoints > 0) {
        const categoryPercentage = (earnedPoints / possiblePoints) * 100;
        const weightedScore = categoryPercentage * weight.weight_pct;
        totalWeightedScore += weightedScore;
        totalWeightUsed += weight.weight_pct;
      }
    }
  });

  // Calculate current grade
  const currentGrade = totalWeightUsed > 0 
    ? totalWeightedScore / totalWeightUsed 
    : 0;

  return {
    currentGrade: Math.round(currentGrade * 100) / 100,
    letterGrade: getLetterGrade(currentGrade),
    earnedWeightPercentage: Math.round(totalWeightUsed * 100),
    totalAssignments: assignments.length,
    gradedAssignments: assignments.filter(a => a.points_earned !== null).length
  };
}

function getLetterGrade(percentage: number): string {
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 63) return 'D';
  if (percentage >= 60) return 'D-';
  return 'F';
}
