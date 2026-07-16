import { Router } from "express";
import { serverError } from "../lib/http.js";
import { db } from "@workspace/db";
import {
  quizzesTable,
  quizQuestionsTable,
  quizOptionsTable,
  quizAttemptsTable,
} from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch all questions + options for a quiz in 2 queries (no N+1). */
async function getQuestionsWithOptions(quizId: number, includeCorrect = false) {
  const questions = await db
    .select()
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.quizId, quizId))
    .orderBy(asc(quizQuestionsTable.order));

  if (questions.length === 0) return [];

  // Batch-fetch all options via a join — single query
  const optionsRaw = await db
    .select()
    .from(quizOptionsTable)
    .innerJoin(quizQuestionsTable, eq(quizOptionsTable.questionId, quizQuestionsTable.id))
    .where(eq(quizQuestionsTable.quizId, quizId))
    .orderBy(asc(quizOptionsTable.order));

  // Group by questionId
  const grouped: Record<number, typeof optionsRaw[0]["quiz_options"][]> = {};
  for (const row of optionsRaw) {
    const qid = row.quiz_options.questionId;
    if (!grouped[qid]) grouped[qid] = [];
    grouped[qid].push(row.quiz_options);
  }

  return questions.map((q) => ({
    ...q,
    options: (grouped[q.id] || []).map((o) => ({
      id: o.id,
      text: o.text,
      textAr: o.textAr,
      order: o.order,
      ...(includeCorrect ? { isCorrect: o.isCorrect } : {}),
    })),
  }));
}

// ── GET all quizzes for a course ──────────────────────────────────────────────
router.get("/course/:courseId", async (req, res) => {
  try {
    const courseId = parseParam(req.params.courseId);
    const quizzes = await db
      .select()
      .from(quizzesTable)
      .where(eq(quizzesTable.courseId, courseId))
      .orderBy(asc(quizzesTable.type));
    res.json(quizzes);
  } catch (err: any) {
    serverError(res, err);
  }
});

// ── GET quiz attached to a specific lesson (student view — no correct answers) ─
router.get("/lesson/:lessonId", async (req, res) => {
  try {
    const lessonId = parseParam(req.params.lessonId);
    const [quiz] = await db
      .select()
      .from(quizzesTable)
      .where(eq(quizzesTable.lessonId, lessonId))
      .limit(1);

    if (!quiz) { res.json(null); return; }

    const questions = await getQuestionsWithOptions(quiz.id, false);
    res.json({ ...quiz, questions });
  } catch (err: any) {
    serverError(res, err);
  }
});

// ── GET the student's best (highest score) attempt for a quiz ─────────────────
router.get("/:quizId/my-attempt", requireAuth, async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    const { userId } = req.user!;

    const attempts = await db
      .select()
      .from(quizAttemptsTable)
      .where(
        and(
          eq(quizAttemptsTable.quizId, quizId),
          eq(quizAttemptsTable.userId, userId)
        )
      )
      .orderBy(desc(quizAttemptsTable.completedAt));

    if (!attempts.length) { res.json(null); return; }

    // Return the best (highest score) attempt so the student sees their peak result
    const best = attempts.reduce((prev, cur) =>
      parseFloat(cur.score as string) > parseFloat(prev.score as string) ? cur : prev
    );
    res.json({ ...best, attemptCount: attempts.length });
  } catch (err: any) {
    serverError(res, err);
  }
});

// ── GET a single quiz with questions (teacher view — includes correct answers) ─
router.get("/:quizId", async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    const [quiz] = await db
      .select()
      .from(quizzesTable)
      .where(eq(quizzesTable.id, quizId))
      .limit(1);
    if (!quiz) { res.status(404).json({ error: "Quiz not found" }); return; }

    const questions = await getQuestionsWithOptions(quizId, true); // include isCorrect
    res.json({ ...quiz, questions });
  } catch (err: any) {
    serverError(res, err);
  }
});

// ── POST create a quiz with questions in one request ──────────────────────────
router.post("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const {
      courseId, lessonId, title, titleAr, description, descriptionAr,
      type, passingScore, timeLimitMinutes, isCompulsory, questions,
    } = req.body;

    if (!courseId || !title || !titleAr) {
      res.status(400).json({ error: "courseId, title and titleAr are required" }); return;
    }

    const [quiz] = await db
      .insert(quizzesTable)
      .values({
        courseId,
        lessonId: lessonId || null,
        title,
        titleAr,
        description: description || null,
        descriptionAr: descriptionAr || null,
        type: type || "lesson",
        passingScore: Math.min(100, Math.max(1, Number(passingScore) || 70)),
        timeLimitMinutes: timeLimitMinutes || null,
        isCompulsory: isCompulsory === true || isCompulsory === "true",
      })
      .returning();

    if (questions && Array.isArray(questions)) {
      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        const [question] = await db
          .insert(quizQuestionsTable)
          .values({
            quizId: quiz.id,
            question: q.question,
            questionAr: q.questionAr || q.question,
            type: q.type || "multiple_choice",
            points: Math.max(1, Number(q.points) || 1),
            explanation: q.explanation || null,
            explanationAr: q.explanationAr || null,
            order: qi,
          })
          .returning();

        if (q.options && Array.isArray(q.options) && q.options.length > 0) {
          await db.insert(quizOptionsTable).values(
            q.options.map((opt: any, oi: number) => ({
              questionId: question.id,
              text: opt.text || "",
              textAr: opt.textAr || opt.text || "",
              isCorrect: opt.isCorrect === true,
              order: oi,
            }))
          );
        }
      }
    }

    const questions_out = await getQuestionsWithOptions(quiz.id, true);
    res.status(201).json({ ...quiz, questions: questions_out });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create quiz", message: err.message });
  }
});

// ── PUT update quiz metadata (settings only — not questions) ──────────────────
router.put("/:quizId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    const { title, titleAr, description, descriptionAr, passingScore, timeLimitMinutes, isCompulsory } = req.body;
    const [updated] = await db
      .update(quizzesTable)
      .set({
        ...(title !== undefined && { title }),
        ...(titleAr !== undefined && { titleAr }),
        ...(description !== undefined && { description }),
        ...(descriptionAr !== undefined && { descriptionAr }),
        ...(passingScore !== undefined && { passingScore: Math.min(100, Math.max(1, Number(passingScore))) }),
        ...(timeLimitMinutes !== undefined && { timeLimitMinutes }),
        ...(isCompulsory !== undefined && { isCompulsory: isCompulsory === true || isCompulsory === "true" }),
        updatedAt: new Date(),
      })
      .where(eq(quizzesTable.id, quizId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Quiz not found" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update quiz", message: err.message });
  }
});

// ── DELETE a quiz (cascades to questions + options via FK) ────────────────────
router.delete("/:quizId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    await db.delete(quizzesTable).where(eq(quizzesTable.id, quizId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to delete quiz", message: err.message });
  }
});

// ── POST submit a quiz attempt (auto-marked) ──────────────────────────────────
router.post("/:quizId/attempt", requireAuth, async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    const { userId } = req.user!;
    const { answers } = req.body;

    if (!answers || typeof answers !== "object") {
      res.status(400).json({ error: "answers must be a {[questionId]: optionId} object" }); return;
    }

    const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);
    if (!quiz) { res.status(404).json({ error: "Quiz not found" }); return; }

    // Fetch questions + all their options in 2 queries (no N+1)
    const questions = await db
      .select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quizId, quizId))
      .orderBy(asc(quizQuestionsTable.order));

    if (questions.length === 0) {
      res.status(400).json({ error: "Quiz has no questions" }); return;
    }

    const optionsRaw = await db
      .select()
      .from(quizOptionsTable)
      .innerJoin(quizQuestionsTable, eq(quizOptionsTable.questionId, quizQuestionsTable.id))
      .where(eq(quizQuestionsTable.quizId, quizId));

    // Group options by questionId
    const grouped: Record<number, typeof optionsRaw[0]["quiz_options"][]> = {};
    for (const row of optionsRaw) {
      const qid = row.quiz_options.questionId;
      if (!grouped[qid]) grouped[qid] = [];
      grouped[qid].push(row.quiz_options);
    }

    let earned = 0;
    let total = 0;

    const detailedResults = questions.map((q) => {
      total += q.points;
      const options = grouped[q.id] || [];
      const correctOption = options.find((o) => o.isCorrect);
      const userAnswer = answers[q.id];
      // Coerce to number for safe comparison (JSON keys are strings, values may vary)
      const isCorrect = correctOption
        ? Number(correctOption.id) === Number(userAnswer)
        : false;
      if (isCorrect) earned += q.points;

      return {
        questionId: q.id,
        question: q.question,
        questionAr: q.questionAr,
        userAnswer,
        correctOptionId: correctOption?.id,
        isCorrect,
        points: q.points,
        earnedPoints: isCorrect ? q.points : 0,
        explanation: q.explanation,
        explanationAr: q.explanationAr,
      };
    });

    const score = total > 0 ? Math.round((earned / total) * 100) : 0;
    const passed = score >= quiz.passingScore;

    const [attempt] = await db
      .insert(quizAttemptsTable)
      .values({
        quizId,
        userId,
        score: score.toString(),
        totalPoints: total,
        earnedPoints: earned,
        passed,
        answers: JSON.stringify(answers),
      })
      .returning();

    res.status(201).json({
      ...attempt,
      score,
      passed,
      earnedPoints: earned,
      totalPoints: total,
      passingScore: quiz.passingScore,
      isCompulsory: quiz.isCompulsory,
      results: detailedResults,
    });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to submit attempt", message: err.message });
  }
});

// ── GET all attempts for a quiz ───────────────────────────────────────────────
router.get("/:quizId/attempts", requireAuth, async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    const { userId, role } = req.user!;
    const whereClause = role === "student"
      ? and(eq(quizAttemptsTable.quizId, quizId), eq(quizAttemptsTable.userId, userId))
      : eq(quizAttemptsTable.quizId, quizId);

    const attempts = await db
      .select()
      .from(quizAttemptsTable)
      .where(whereClause)
      .orderBy(desc(quizAttemptsTable.completedAt));

    res.json(attempts);
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
