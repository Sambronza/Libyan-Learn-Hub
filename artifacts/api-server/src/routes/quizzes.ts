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

// ── GET quiz attached to a specific lesson ────────────────────────────────────
router.get("/lesson/:lessonId", async (req, res) => {
  try {
    const lessonId = parseParam(req.params.lessonId);
    const [quiz] = await db
      .select()
      .from(quizzesTable)
      .where(eq(quizzesTable.lessonId, lessonId))
      .limit(1);

    if (!quiz) { res.json(null); return; }

    const questions = await db
      .select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quizId, quiz.id))
      .orderBy(asc(quizQuestionsTable.order));

    const questionsWithOptions = await Promise.all(
      questions.map(async (q) => {
        const options = await db
          .select()
          .from(quizOptionsTable)
          .where(eq(quizOptionsTable.questionId, q.id))
          .orderBy(asc(quizOptionsTable.order));
        return {
          ...q,
          options: options.map((o) => ({
            id: o.id,
            text: o.text,
            textAr: o.textAr,
            order: o.order,
          })),
        };
      })
    );

    res.json({ ...quiz, questions: questionsWithOptions });
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

// ── GET a single quiz with questions ─────────────────────────────────────────
router.get("/:quizId", async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    const [quiz] = await db
      .select()
      .from(quizzesTable)
      .where(eq(quizzesTable.id, quizId))
      .limit(1);
    if (!quiz) { res.status(404).json({ error: "Quiz not found" }); return; }

    const questions = await db
      .select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quizId, quizId))
      .orderBy(asc(quizQuestionsTable.order));

    const questionsWithOptions = await Promise.all(
      questions.map(async (q) => {
        const options = await db
          .select()
          .from(quizOptionsTable)
          .where(eq(quizOptionsTable.questionId, q.id))
          .orderBy(asc(quizOptionsTable.order));
        return {
          ...q,
          options: options.map((o) => ({
            id: o.id,
            text: o.text,
            textAr: o.textAr,
            isCorrect: o.isCorrect,
            order: o.order,
          })),
        };
      })
    );

    res.json({ ...quiz, questions: questionsWithOptions });
  } catch (err: any) {
    serverError(res, err);
  }
});

// ── POST create a quiz ────────────────────────────────────────────────────────
router.post("/", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const {
      courseId, lessonId, title, titleAr, description, descriptionAr,
      type, passingScore, timeLimitMinutes, isCompulsory, questions
    } = req.body;

    const [quiz] = await db
      .insert(quizzesTable)
      .values({
        courseId,
        lessonId: lessonId || null,
        title,
        titleAr,
        description,
        descriptionAr,
        type: type || "lesson",
        passingScore: passingScore || 70,
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
            points: q.points || 1,
            explanation: q.explanation,
            explanationAr: q.explanationAr,
            order: qi,
          })
          .returning();

        if (q.options && Array.isArray(q.options)) {
          await db.insert(quizOptionsTable).values(
            q.options.map((opt: any, oi: number) => ({
              questionId: question.id,
              text: opt.text,
              textAr: opt.textAr || opt.text,
              isCorrect: opt.isCorrect || false,
              order: oi,
            }))
          );
        }
      }
    }

    const [fullQuiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quiz.id)).limit(1);
    res.status(201).json(fullQuiz);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create quiz", message: err.message });
  }
});

// ── PUT update quiz metadata ──────────────────────────────────────────────────
router.put("/:quizId", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    const { title, titleAr, description, descriptionAr, passingScore, timeLimitMinutes, isCompulsory } = req.body;
    const [updated] = await db
      .update(quizzesTable)
      .set({
        title,
        titleAr,
        description,
        descriptionAr,
        passingScore,
        timeLimitMinutes,
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

// ── DELETE a quiz ─────────────────────────────────────────────────────────────
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

    const questions = await db
      .select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quizId, quizId))
      .orderBy(asc(quizQuestionsTable.order));

    let earned = 0;
    let total = 0;

    const detailedResults = await Promise.all(
      questions.map(async (q) => {
        total += q.points;
        const options = await db
          .select()
          .from(quizOptionsTable)
          .where(eq(quizOptionsTable.questionId, q.id));

        const correctOption = options.find((o) => o.isCorrect);
        const userAnswer = answers?.[q.id];
        const isCorrect = correctOption ? correctOption.id === userAnswer : false;
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
      })
    );

    const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);
    const score = total > 0 ? Math.round((earned / total) * 100) : 0;
    const passed = score >= (quiz?.passingScore || 70);

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
      passingScore: quiz?.passingScore || 70,
      isCompulsory: quiz?.isCompulsory || false,
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

// ── POST add a question to an existing quiz ───────────────────────────────────
router.post("/:quizId/questions", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
  try {
    const quizId = parseParam(req.params.quizId);
    const { question, questionAr, type, points, explanation, explanationAr, order, options } = req.body;
    const [q] = await db
      .insert(quizQuestionsTable)
      .values({
        quizId,
        question,
        questionAr: questionAr || question,
        type: type || "multiple_choice",
        points: points || 1,
        explanation,
        explanationAr,
        order: order || 0,
      })
      .returning();

    if (options && Array.isArray(options)) {
      await db.insert(quizOptionsTable).values(
        options.map((opt: any, i: number) => ({
          questionId: q.id,
          text: opt.text,
          textAr: opt.textAr || opt.text,
          isCorrect: opt.isCorrect || false,
          order: i,
        }))
      );
    }

    const fullOptions = await db.select().from(quizOptionsTable).where(eq(quizOptionsTable.questionId, q.id));
    res.status(201).json({ ...q, options: fullOptions });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to add question", message: err.message });
  }
});

export default router;
