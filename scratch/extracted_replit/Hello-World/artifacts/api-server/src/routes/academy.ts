import { Router } from "express";
import { db } from "@workspace/db";
import {
  academyProgramsTable,
  academySemestersTable,
  academySubjectsTable,
  academyApplicationsTable,
  academyEnrollmentsTable,
  academyRegistrationsTable,
  academyParentLinksTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { parseParam } from "../lib/utils.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// GET /academy/programs — List all active programs
router.get("/programs", async (_req, res) => {
  try {
    const programs = await db
      .select({
        id: academyProgramsTable.id,
        name: academyProgramsTable.name,
        nameAr: academyProgramsTable.nameAr,
        description: academyProgramsTable.description,
        descriptionAr: academyProgramsTable.descriptionAr,
        type: academyProgramsTable.type,
        gradeLevel: academyProgramsTable.gradeLevel,
        durationYears: academyProgramsTable.durationYears,
        tuitionPerSemester: academyProgramsTable.tuitionPerSemester,
        currency: academyProgramsTable.currency,
        isActive: academyProgramsTable.isActive,
        subjectCount: sql<number>`(SELECT COUNT(*) FROM academy_subjects WHERE program_id = ${academyProgramsTable.id})`.as("subject_count"),
      })
      .from(academyProgramsTable)
      .where(eq(academyProgramsTable.isActive, true))
      .orderBy(academyProgramsTable.gradeLevel);

    res.json(programs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /academy/programs/:id — Program details with subjects
router.get("/programs/:id", async (req, res) => {
  try {
    const programId = parseParam(req.params.id);
    const [program] = await db
      .select()
      .from(academyProgramsTable)
      .where(eq(academyProgramsTable.id, programId));

    if (!program) {
      res.status(404).json({ error: "Program not found" });
      return;
    }

    const subjects = await db
      .select({
        id: academySubjectsTable.id,
        name: academySubjectsTable.name,
        nameAr: academySubjectsTable.nameAr,
        description: academySubjectsTable.description,
        descriptionAr: academySubjectsTable.descriptionAr,
        gradeLevel: academySubjectsTable.gradeLevel,
        semesterNumber: academySubjectsTable.semesterNumber,
        creditHours: academySubjectsTable.creditHours,
        teacherName: usersTable.fullName,
        teacherNameAr: usersTable.fullNameAr,
      })
      .from(academySubjectsTable)
      .leftJoin(usersTable, eq(academySubjectsTable.teacherId, usersTable.id))
      .where(and(
        eq(academySubjectsTable.programId, programId),
        eq(academySubjectsTable.isActive, true),
      ))
      .orderBy(academySubjectsTable.gradeLevel, academySubjectsTable.semesterNumber);

    const semesters = await db
      .select()
      .from(academySemestersTable)
      .where(eq(academySemestersTable.programId, programId))
      .orderBy(desc(academySemestersTable.startDate));

    res.json({ ...program, subjects, semesters });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// STUDENT ENDPOINTS (auth required)
// ═══════════════════════════════════════════════════════════════

// POST /academy/apply — Submit an application
router.post("/apply", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { programId, gradeLevel, previousSchool, previousSchoolAr, documentsUrl, parentName, parentNameAr, parentPhone, parentEmail, notes } = req.body;

    if (!programId || !gradeLevel) {
      res.status(400).json({ error: "programId and gradeLevel are required" });
      return;
    }

    // Check for duplicate application
    const [existing] = await db
      .select()
      .from(academyApplicationsTable)
      .where(and(
        eq(academyApplicationsTable.userId, userId),
        eq(academyApplicationsTable.programId, programId),
      ));

    if (existing && existing.status === "pending") {
      res.status(409).json({ error: "You already have a pending application for this program" });
      return;
    }

    const [application] = await db
      .insert(academyApplicationsTable)
      .values({
        userId,
        programId,
        gradeLevel,
        previousSchool,
        previousSchoolAr,
        documentsUrl,
        parentName,
        parentNameAr,
        parentPhone,
        parentEmail,
        notes,
        status: "pending",
      })
      .returning();

    res.status(201).json(application);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /academy/my-application — Check application status
router.get("/my-application", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const applications = await db
      .select({
        id: academyApplicationsTable.id,
        status: academyApplicationsTable.status,
        gradeLevel: academyApplicationsTable.gradeLevel,
        reviewNotes: academyApplicationsTable.reviewNotes,
        appliedAt: academyApplicationsTable.appliedAt,
        reviewedAt: academyApplicationsTable.reviewedAt,
        programName: academyProgramsTable.name,
        programNameAr: academyProgramsTable.nameAr,
        programType: academyProgramsTable.type,
      })
      .from(academyApplicationsTable)
      .innerJoin(academyProgramsTable, eq(academyApplicationsTable.programId, academyProgramsTable.id))
      .where(eq(academyApplicationsTable.userId, userId))
      .orderBy(desc(academyApplicationsTable.appliedAt));

    res.json(applications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /academy/my-enrollment — Get current enrollment with subjects
router.get("/my-enrollment", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const enrollments = await db
      .select({
        id: academyEnrollmentsTable.id,
        status: academyEnrollmentsTable.status,
        currentGradeLevel: academyEnrollmentsTable.currentGradeLevel,
        gpa: academyEnrollmentsTable.gpa,
        enrolledAt: academyEnrollmentsTable.enrolledAt,
        programName: academyProgramsTable.name,
        programNameAr: academyProgramsTable.nameAr,
        programType: academyProgramsTable.type,
        semesterName: academySemestersTable.name,
        semesterNameAr: academySemestersTable.nameAr,
        academicYear: academySemestersTable.academicYear,
      })
      .from(academyEnrollmentsTable)
      .innerJoin(academyProgramsTable, eq(academyEnrollmentsTable.programId, academyProgramsTable.id))
      .innerJoin(academySemestersTable, eq(academyEnrollmentsTable.semesterId, academySemestersTable.id))
      .where(eq(academyEnrollmentsTable.userId, userId))
      .orderBy(desc(academyEnrollmentsTable.enrolledAt));

    if (enrollments.length === 0) {
      res.json({ enrolled: false, enrollments: [] });
      return;
    }

    // Get registrations for latest enrollment
    const latestEnrollment = enrollments[0];
    const registrations = await db
      .select({
        id: academyRegistrationsTable.id,
        grade: academyRegistrationsTable.grade,
        status: academyRegistrationsTable.status,
        subjectName: academySubjectsTable.name,
        subjectNameAr: academySubjectsTable.nameAr,
        creditHours: academySubjectsTable.creditHours,
        teacherName: usersTable.fullName,
        teacherNameAr: usersTable.fullNameAr,
      })
      .from(academyRegistrationsTable)
      .innerJoin(academySubjectsTable, eq(academyRegistrationsTable.subjectId, academySubjectsTable.id))
      .leftJoin(usersTable, eq(academySubjectsTable.teacherId, usersTable.id))
      .where(eq(academyRegistrationsTable.enrollmentId, latestEnrollment.id));

    res.json({
      enrolled: true,
      current: { ...latestEnrollment, registrations },
      history: enrollments.slice(1),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PARENT ENDPOINTS (auth required)
// ═══════════════════════════════════════════════════════════════

// POST /academy/parent/link — Request to link to a student
router.post("/parent/link", requireAuth, async (req, res) => {
  try {
    const parentUserId = (req as any).user.userId;
    const { studentEmail, relationship } = req.body;

    if (!studentEmail) {
      res.status(400).json({ error: "studentEmail is required" });
      return;
    }

    // Find the student
    const [student] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, studentEmail));

    if (!student) {
      res.status(404).json({ error: "Student not found with that email" });
      return;
    }

    if (student.id === parentUserId) {
      res.status(400).json({ error: "Cannot link to yourself" });
      return;
    }

    // Check for existing link
    const [existing] = await db
      .select()
      .from(academyParentLinksTable)
      .where(and(
        eq(academyParentLinksTable.parentUserId, parentUserId),
        eq(academyParentLinksTable.studentUserId, student.id),
      ));

    if (existing) {
      res.status(409).json({ error: "Link already exists" });
      return;
    }

    const [link] = await db
      .insert(academyParentLinksTable)
      .values({
        parentUserId,
        studentUserId: student.id,
        relationship: relationship || "parent",
        isApproved: false,
      })
      .returning();

    res.status(201).json(link);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /academy/parent/children — List linked students
router.get("/parent/children", requireAuth, async (req, res) => {
  try {
    const parentUserId = (req as any).user.userId;

    const children = await db
      .select({
        linkId: academyParentLinksTable.id,
        relationship: academyParentLinksTable.relationship,
        isApproved: academyParentLinksTable.isApproved,
        studentId: usersTable.id,
        studentName: usersTable.fullName,
        studentNameAr: usersTable.fullNameAr,
        studentEmail: usersTable.email,
      })
      .from(academyParentLinksTable)
      .innerJoin(usersTable, eq(academyParentLinksTable.studentUserId, usersTable.id))
      .where(eq(academyParentLinksTable.parentUserId, parentUserId));

    res.json(children);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /academy/parent/child/:studentId/progress — View child's progress
router.get("/parent/child/:studentId/progress", requireAuth, async (req, res) => {
  try {
    const parentUserId = (req as any).user.userId;
    const studentId = parseParam(req.params.studentId);

    // Verify link exists and is approved
    const [link] = await db
      .select()
      .from(academyParentLinksTable)
      .where(and(
        eq(academyParentLinksTable.parentUserId, parentUserId),
        eq(academyParentLinksTable.studentUserId, studentId),
        eq(academyParentLinksTable.isApproved, true),
      ));

    if (!link) {
      res.status(403).json({ error: "No approved parent link for this student" });
      return;
    }

    // Get student's enrollments and registrations
    const enrollments = await db
      .select({
        enrollmentId: academyEnrollmentsTable.id,
        status: academyEnrollmentsTable.status,
        gpa: academyEnrollmentsTable.gpa,
        currentGradeLevel: academyEnrollmentsTable.currentGradeLevel,
        programName: academyProgramsTable.name,
        programNameAr: academyProgramsTable.nameAr,
        semesterName: academySemestersTable.name,
        semesterNameAr: academySemestersTable.nameAr,
      })
      .from(academyEnrollmentsTable)
      .innerJoin(academyProgramsTable, eq(academyEnrollmentsTable.programId, academyProgramsTable.id))
      .innerJoin(academySemestersTable, eq(academyEnrollmentsTable.semesterId, academySemestersTable.id))
      .where(eq(academyEnrollmentsTable.userId, studentId));

    // Get registrations for each enrollment
    const enrollmentIds = enrollments.map(e => e.enrollmentId);
    let registrations: any[] = [];
    if (enrollmentIds.length > 0) {
      registrations = await db
        .select({
          enrollmentId: academyRegistrationsTable.enrollmentId,
          subjectName: academySubjectsTable.name,
          subjectNameAr: academySubjectsTable.nameAr,
          grade: academyRegistrationsTable.grade,
          status: academyRegistrationsTable.status,
        })
        .from(academyRegistrationsTable)
        .innerJoin(academySubjectsTable, eq(academyRegistrationsTable.subjectId, academySubjectsTable.id))
        .where(sql`${academyRegistrationsTable.enrollmentId} = ANY(${enrollmentIds})`);
    }

    res.json({
      enrollments: enrollments.map(e => ({
        ...e,
        subjects: registrations.filter(r => r.enrollmentId === e.enrollmentId),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// GET /academy/admin/applications — List all applications
router.get("/admin/applications", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    
    let query = db
      .select({
        id: academyApplicationsTable.id,
        status: academyApplicationsTable.status,
        gradeLevel: academyApplicationsTable.gradeLevel,
        previousSchool: academyApplicationsTable.previousSchool,
        parentName: academyApplicationsTable.parentName,
        parentPhone: academyApplicationsTable.parentPhone,
        appliedAt: academyApplicationsTable.appliedAt,
        reviewedAt: academyApplicationsTable.reviewedAt,
        studentName: usersTable.fullName,
        studentNameAr: usersTable.fullNameAr,
        studentEmail: usersTable.email,
        programName: academyProgramsTable.name,
        programNameAr: academyProgramsTable.nameAr,
        programType: academyProgramsTable.type,
      })
      .from(academyApplicationsTable)
      .innerJoin(usersTable, eq(academyApplicationsTable.userId, usersTable.id))
      .innerJoin(academyProgramsTable, eq(academyApplicationsTable.programId, academyProgramsTable.id))
      .orderBy(desc(academyApplicationsTable.appliedAt));

    const results = statusFilter
      ? await (query as any).where(eq(academyApplicationsTable.status, statusFilter as any))
      : await query;

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /academy/admin/applications/:id — Approve or reject
router.put("/admin/applications/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const applicationId = parseParam(req.params.id);
    const adminId = (req as any).user.userId;
    const { status, reviewNotes } = req.body;

    if (!["approved", "rejected", "waitlisted"].includes(status)) {
      res.status(400).json({ error: "status must be approved, rejected, or waitlisted" });
      return;
    }

    const [updated] = await db
      .update(academyApplicationsTable)
      .set({
        status,
        reviewNotes,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(academyApplicationsTable.id, applicationId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    // If approved, auto-create enrollment
    if (status === "approved") {
      // Get the active semester for this program
      const [activeSemester] = await db
        .select()
        .from(academySemestersTable)
        .where(and(
          eq(academySemestersTable.programId, updated.programId),
          eq(academySemestersTable.isActive, true),
        ))
        .orderBy(desc(academySemestersTable.startDate))
        .limit(1);

      if (activeSemester) {
        const [enrollment] = await db
          .insert(academyEnrollmentsTable)
          .values({
            userId: updated.userId,
            programId: updated.programId,
            semesterId: activeSemester.id,
            applicationId: updated.id,
            status: "active",
            currentGradeLevel: updated.gradeLevel,
          })
          .returning();

        // Auto-register for all subjects in this grade/semester
        const subjects = await db
          .select()
          .from(academySubjectsTable)
          .where(and(
            eq(academySubjectsTable.programId, updated.programId),
            eq(academySubjectsTable.gradeLevel, updated.gradeLevel),
            eq(academySubjectsTable.isActive, true),
          ));

        if (subjects.length > 0) {
          await db.insert(academyRegistrationsTable).values(
            subjects.map(s => ({
              enrollmentId: enrollment.id,
              subjectId: s.id,
              semesterId: activeSemester.id,
              status: "registered" as const,
            }))
          );
        }
      }
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /academy/admin/programs — Create a program
router.post("/admin/programs", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, nameAr, description, descriptionAr, type, gradeLevel, durationYears, tuitionPerSemester, currency } = req.body;

    const [program] = await db
      .insert(academyProgramsTable)
      .values({ name, nameAr, description, descriptionAr, type, gradeLevel, durationYears, tuitionPerSemester, currency })
      .returning();

    res.status(201).json(program);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /academy/admin/programs/:id — Update a program
router.put("/admin/programs/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const programId = parseParam(req.params.id);
    const { name, nameAr, description, descriptionAr, type, gradeLevel, durationYears, tuitionPerSemester, currency, isActive } = req.body;

    const [updated] = await db
      .update(academyProgramsTable)
      .set({ name, nameAr, description, descriptionAr, type, gradeLevel, durationYears, tuitionPerSemester, currency, isActive, updatedAt: new Date() })
      .where(eq(academyProgramsTable.id, programId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Program not found" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /academy/admin/semesters — Create a semester
router.post("/admin/semesters", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, nameAr, programId, academicYear, semesterNumber, startDate, endDate, isActive } = req.body;

    const [semester] = await db
      .insert(academySemestersTable)
      .values({ name, nameAr, programId, academicYear, semesterNumber, startDate, endDate, isActive })
      .returning();

    res.status(201).json(semester);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /academy/admin/subjects — Create a subject
router.post("/admin/subjects", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, nameAr, description, descriptionAr, programId, gradeLevel, semesterNumber, creditHours, prerequisiteSubjectId, teacherId } = req.body;

    const [subject] = await db
      .insert(academySubjectsTable)
      .values({ name, nameAr, description, descriptionAr, programId, gradeLevel, semesterNumber, creditHours, prerequisiteSubjectId, teacherId })
      .returning();

    res.status(201).json(subject);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /academy/admin/subjects/:id — Update a subject
router.put("/admin/subjects/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const subjectId = parseParam(req.params.id);
    const updates = req.body;

    const [updated] = await db
      .update(academySubjectsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(academySubjectsTable.id, subjectId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Subject not found" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /academy/admin/enrollments — List all enrollments
router.get("/admin/enrollments", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const enrollments = await db
      .select({
        id: academyEnrollmentsTable.id,
        status: academyEnrollmentsTable.status,
        gpa: academyEnrollmentsTable.gpa,
        currentGradeLevel: academyEnrollmentsTable.currentGradeLevel,
        enrolledAt: academyEnrollmentsTable.enrolledAt,
        studentName: usersTable.fullName,
        studentEmail: usersTable.email,
        programName: academyProgramsTable.name,
        programNameAr: academyProgramsTable.nameAr,
        semesterName: academySemestersTable.name,
      })
      .from(academyEnrollmentsTable)
      .innerJoin(usersTable, eq(academyEnrollmentsTable.userId, usersTable.id))
      .innerJoin(academyProgramsTable, eq(academyEnrollmentsTable.programId, academyProgramsTable.id))
      .innerJoin(academySemestersTable, eq(academyEnrollmentsTable.semesterId, academySemestersTable.id))
      .orderBy(desc(academyEnrollmentsTable.enrolledAt));

    res.json(enrollments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /academy/admin/registrations/:id/grade — Post a grade
router.put("/admin/registrations/:id/grade", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const registrationId = parseParam(req.params.id);
    const { grade, status } = req.body;

    const [updated] = await db
      .update(academyRegistrationsTable)
      .set({
        grade: grade?.toString(),
        status: status || (Number(grade) >= 50 ? "completed" : "failed"),
        updatedAt: new Date(),
      })
      .where(eq(academyRegistrationsTable.id, registrationId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Registration not found" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /academy/admin/parent-links/:id/approve — Approve parent link
router.put("/admin/parent-links/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const linkId = parseParam(req.params.id);
    const { isApproved } = req.body;

    const [updated] = await db
      .update(academyParentLinksTable)
      .set({ isApproved: isApproved ?? true })
      .where(eq(academyParentLinksTable.id, linkId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Parent link not found" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
