import { z } from 'zod';

// Schema for extracted syllabus data
export const GradeWeightSchema = z.object({
  name: z.string(),
  weight_pct: z.number().min(0).max(1)
});

export const AssignmentSchema = z.object({
  title: z.string(),
  type: z.enum(['homework', 'quiz', 'exam', 'project', 'participation', 'other']).optional(),
  dueDate: z.string().optional(), // ISO date string
  week_no: z.number().optional(),
  points: z.number().optional(),
  weight_category: z.string().optional()
});

export const ExtractedSyllabusSchema = z.object({
  course_info: z.object({
    name: z.string().optional(),
    code: z.string().optional(),
    instructor: z.string().optional(),
    semester: z.string().optional(),
    credits: z.number().optional()
  }).optional(),
  grading_weights: z.array(GradeWeightSchema),
  assignments: z.array(AssignmentSchema),
  schedule: z.array(z.object({
    week_no: z.number(),
    date: z.string().optional(),
    topic: z.string().optional(),
    assignments: z.array(z.string()).optional()
  })).optional()
});

export type ExtractedSyllabus = z.infer<typeof ExtractedSyllabusSchema>;

// LLM prompt for syllabus extraction
export const SYLLABUS_EXTRACTION_PROMPT = `
You are an expert at extracting structured information from academic syllabi.
Extract the following information from the provided syllabus text:

1. Course Information:
   - Course name and code
   - Instructor name
   - Semester/term
   - Credit hours

2. Grading Weights (CRITICAL):
   - Extract all grading categories and their percentage weights
   - Examples: "Homework: 20%", "Midterm Exam: 25%", "Final Exam: 30%", "Participation: 10%"
   - Convert percentages to decimals (20% = 0.20)

3. Assignments and Due Dates:
   - Extract all assignments, quizzes, exams, projects mentioned
   - Include due dates if specified (format as YYYY-MM-DD)
   - Include week numbers if mentioned
   - Include point values if specified
   - Map to appropriate grading category

4. Weekly Schedule (if present):
   - Week numbers and dates
   - Topics covered
   - Assignments due that week

Return the extracted information as valid JSON matching this schema:
{
  "course_info": {
    "name": "string",
    "code": "string",
    "instructor": "string",
    "semester": "string",
    "credits": number
  },
  "grading_weights": [
    {"name": "string", "weight_pct": number}
  ],
  "assignments": [
    {
      "title": "string",
      "type": "homework|quiz|exam|project|participation|other",
      "dueDate": "YYYY-MM-DD",
      "week_no": number,
      "points": number,
      "weight_category": "string"
    }
  ],
  "schedule": [
    {
      "week_no": number,
      "date": "YYYY-MM-DD",
      "topic": "string",
      "assignments": ["string"]
    }
  ]
}

IMPORTANT:
- Ensure all percentages sum to 100% (or 1.0 in decimal)
- Use consistent naming for grading categories
- If dates are relative (e.g., "Week 5"), calculate based on semester start date if provided
- Extract ALL assignments mentioned, even if dates are unclear
`;

// Schedule-specific extraction prompt
export const SCHEDULE_EXTRACTION_PROMPT = `
You are extracting information from a course schedule document.
Focus on extracting:

1. Weekly breakdown with dates
2. Topics for each week
3. Assignment due dates
4. Exam dates
5. Important deadlines

Map all dates to ISO format (YYYY-MM-DD) where possible.
For relative dates (Week X), include the week number.

Return as JSON:
{
  "schedule": [
    {
      "week_no": number,
      "date": "YYYY-MM-DD",
      "topic": "string",
      "assignments": ["string"]
    }
  ],
  "assignments": [
    {
      "title": "string",
      "type": "homework|quiz|exam|project|participation|other",
      "dueDate": "YYYY-MM-DD",
      "week_no": number
    }
  ]
}
`;

export class SyllabusExtractor {
  constructor(
    private env: Env,
    private aiService: any // Your AI service for LLM calls
  ) {}

  async extractFromText(
    text: string,
    documentType: 'syllabus' | 'schedule' = 'syllabus'
  ): Promise<ExtractedSyllabus> {
    const prompt = documentType === 'schedule' 
      ? SCHEDULE_EXTRACTION_PROMPT 
      : SYLLABUS_EXTRACTION_PROMPT;

    try {
      // Call LLM to extract structured data
      const response = await this.aiService.generateStructuredOutput({
        prompt: `${prompt}\n\nDocument text:\n${text}`,
        schema: ExtractedSyllabusSchema,
        temperature: 0.1 // Low temperature for consistent extraction
      });

      return response;
    } catch (error) {
      console.error('Failed to extract syllabus data:', error);
      throw new Error('Failed to parse syllabus content');
    }
  }

  // Merge syllabus and schedule data
  mergeSyllabusData(
    syllabus: ExtractedSyllabus,
    schedule?: ExtractedSyllabus
  ): ExtractedSyllabus {
    if (!schedule) return syllabus;

    // Merge assignments, avoiding duplicates
    const mergedAssignments = [...syllabus.assignments];
    const existingTitles = new Set(syllabus.assignments.map(a => a.title.toLowerCase()));
    
    for (const assignment of schedule.assignments || []) {
      if (!existingTitles.has(assignment.title.toLowerCase())) {
        mergedAssignments.push(assignment);
      } else {
        // Update existing assignment with schedule data (dates are often more precise in schedules)
        const index = mergedAssignments.findIndex(
          a => a.title.toLowerCase() === assignment.title.toLowerCase()
        );
        if (index >= 0 && assignment.dueDate) {
          mergedAssignments[index] = {
            ...mergedAssignments[index],
            ...assignment,
            weight_category: mergedAssignments[index].weight_category // Preserve from syllabus
          };
        }
      }
    }

    // Merge or replace schedule
    const mergedSchedule = schedule.schedule || syllabus.schedule;

    return {
      ...syllabus,
      assignments: mergedAssignments,
      schedule: mergedSchedule
    };
  }

  // Validate extracted data
  validateExtractedData(data: ExtractedSyllabus): string[] {
    const errors: string[] = [];

    // Check if grading weights sum to approximately 100%
    if (data.grading_weights.length > 0) {
      const totalWeight = data.grading_weights.reduce((sum, w) => sum + w.weight_pct, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        errors.push(`Grading weights sum to ${(totalWeight * 100).toFixed(1)}%, not 100%`);
      }
    }

    // Check for assignments without categories if weights exist
    if (data.grading_weights.length > 0) {
      const weightCategories = new Set(data.grading_weights.map(w => w.name.toLowerCase()));
      const uncategorized = data.assignments.filter(
        a => !a.weight_category || !weightCategories.has(a.weight_category.toLowerCase())
      );
      if (uncategorized.length > 0) {
        errors.push(`${uncategorized.length} assignments lack valid grading categories`);
      }
    }

    return errors;
  }
}