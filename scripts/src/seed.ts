import { db } from "@workspace/db";
import {
  categoriesTable,
  usersTable,
  coursesTable,
  sectionsTable,
  lessonsTable,
  slidesTable,
  quizzesTable,
  quizQuestionsTable,
  quizOptionsTable,
  enrollmentsTable,
  liveSessionsTable,
  tutoringListingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  const pwdHash = await bcrypt.hash("password123", 10);

  // ── Categories ──────────────────────────────────────────────────────────────
  await db.insert(categoriesTable).values([
    { name: "Mathematics",       nameAr: "الرياضيات",          icon: "📐" },
    { name: "Sciences",          nameAr: "العلوم",              icon: "🔬" },
    { name: "Arabic Language",   nameAr: "اللغة العربية",       icon: "📖" },
    { name: "English Language",  nameAr: "اللغة الإنجليزية",    icon: "🇬🇧" },
    { name: "History",           nameAr: "التاريخ",             icon: "🏛️" },
    { name: "Physics",           nameAr: "الفيزياء",            icon: "⚛️" },
    { name: "Chemistry",         nameAr: "الكيمياء",            icon: "🧪" },
    { name: "Biology",           nameAr: "الأحياء",             icon: "🧬" },
    { name: "Computer Science",  nameAr: "علوم الحاسوب",        icon: "💻" },
    { name: "Islamic Studies",   nameAr: "الدراسات الإسلامية",  icon: "🌙" },
  ]).onConflictDoNothing();
  console.log("Categories OK");

  // ── Teachers ─────────────────────────────────────────────────────────────────
  await db.insert(usersTable).values([
    {
      email: "ahmed@lms.ly", passwordHash: pwdHash,
      fullName: "Ahmed Al-Mansouri", fullNameAr: "أحمد المنصوري",
      role: "teacher" as const,
      bio: "Mathematics professor with 15 years of experience",
      bioAr: "أستاذ الرياضيات بخبرة 15 عامًا",
      expertise: "Mathematics, Algebra, Calculus",
      language: "ar" as const, isVerified: true, emailVerified: true,
    },
    {
      email: "fatima@lms.ly", passwordHash: pwdHash,
      fullName: "Fatima Al-Zawiya", fullNameAr: "فاطمة الزاوية",
      role: "teacher" as const,
      bio: "Physics and Chemistry teacher",
      bioAr: "معلمة الفيزياء والكيمياء",
      expertise: "Physics, Chemistry",
      language: "ar" as const, isVerified: true, emailVerified: true,
    },
    {
      email: "omar@lms.ly", passwordHash: pwdHash,
      fullName: "Omar Benghazi", fullNameAr: "عمر البنغازي",
      role: "teacher" as const,
      bio: "Computer Science instructor",
      bioAr: "مدرس علوم الحاسوب",
      expertise: "Programming, Web Development",
      language: "ar" as const, isVerified: true, emailVerified: true,
    },
  ]).onConflictDoNothing();
  console.log("Teachers OK");

  // ── Students ──────────────────────────────────────────────────────────────────
  await db.insert(usersTable).values([
    {
      email: "student@lms.ly", passwordHash: pwdHash,
      fullName: "Ali Student", fullNameAr: "علي الطالب",
      role: "student" as const, language: "ar" as const,
      isVerified: true, emailVerified: true,
    },
    {
      email: "sara@lms.ly", passwordHash: pwdHash,
      fullName: "Sara Al-Fassi", fullNameAr: "سارة الفاسي",
      role: "student" as const, language: "ar" as const,
      isVerified: true, emailVerified: true,
    },
  ]).onConflictDoNothing();
  console.log("Students OK");

  // ── Fetch inserted rows ───────────────────────────────────────────────────────
  const allCats     = await db.select().from(categoriesTable);
  const allTeachers = await db.select().from(usersTable).where(eq(usersTable.role, "teacher"));
  const allStudents = await db.select().from(usersTable).where(eq(usersTable.role, "student"));

  const mathCat    = allCats.find(c => c.name === "Mathematics")!;
  const physicsCat = allCats.find(c => c.name === "Physics")!;
  const csCat      = allCats.find(c => c.name === "Computer Science")!;
  const arabicCat  = allCats.find(c => c.name === "Arabic Language")!;
  const chemCat    = allCats.find(c => c.name === "Chemistry")!;
  const bioCat     = allCats.find(c => c.name === "Biology")!;

  const t1 = allTeachers.find(t => t.email === "ahmed@lms.ly")!;
  const t2 = allTeachers.find(t => t.email === "fatima@lms.ly")!;
  const t3 = allTeachers.find(t => t.email === "omar@lms.ly")!;

  if (!t1 || !t2 || !t3) { console.log("Teachers not found, aborting"); return; }

  // ── Courses ───────────────────────────────────────────────────────────────────
  const courses = await db.insert(coursesTable).values([
    {
      title: "Algebra Fundamentals",           titleAr: "أساسيات الجبر",
      description: "Complete algebra course from basics to advanced",
      descriptionAr: "دورة شاملة في الجبر من الأساسيات إلى المتقدم",
      price: "150.00", level: "beginner" as const, language: "ar",
      categoryId: mathCat.id, teacherId: t1.id, isPublished: true,
      thumbnailUrl: "/images/course-math.jpg",
    },
    {
      title: "Calculus I",                     titleAr: "حساب التفاضل والتكامل ١",
      description: "Introduction to differential and integral calculus",
      descriptionAr: "مقدمة في حساب التفاضل والتكامل",
      price: "200.00", level: "intermediate" as const, language: "ar",
      categoryId: mathCat.id, teacherId: t1.id, isPublished: true,
      thumbnailUrl: "/images/course-calc.jpg",
    },
    {
      title: "Physics: Mechanics",             titleAr: "الفيزياء: الميكانيكا",
      description: "Classical mechanics and Newtonian physics",
      descriptionAr: "الميكانيكا الكلاسيكية وفيزياء نيوتن",
      price: "180.00", level: "intermediate" as const, language: "ar",
      categoryId: physicsCat.id, teacherId: t2.id, isPublished: true,
    },
    {
      title: "Web Development Basics",         titleAr: "أساسيات تطوير الويب",
      description: "HTML, CSS, JavaScript fundamentals",
      descriptionAr: "أساسيات HTML وCSS وJavaScript",
      price: "250.00", level: "beginner" as const, language: "ar",
      categoryId: csCat.id, teacherId: t3.id, isPublished: true,
    },
    {
      title: "Python Programming",             titleAr: "برمجة بايثون",
      description: "Complete Python programming course",
      descriptionAr: "دورة شاملة في برمجة بايثون",
      price: "300.00", level: "beginner" as const, language: "en",
      categoryId: csCat.id, teacherId: t3.id, isPublished: true,
    },
    {
      title: "Arabic Grammar",                 titleAr: "قواعد اللغة العربية",
      description: "Comprehensive Arabic grammar and linguistics",
      descriptionAr: "قواعد شاملة في النحو والصرف",
      price: "100.00", level: "beginner" as const, language: "ar",
      categoryId: arabicCat.id, teacherId: t1.id, isPublished: true,
    },
    {
      title: "Organic Chemistry",              titleAr: "الكيمياء العضوية",
      description: "Introduction to organic chemistry",
      descriptionAr: "مقدمة في الكيمياء العضوية",
      price: "220.00", level: "advanced" as const, language: "ar",
      categoryId: chemCat.id, teacherId: t2.id, isPublished: true,
    },
    {
      title: "Cell Biology",                   titleAr: "علم الخلية",
      description: "Introduction to cell biology and genetics",
      descriptionAr: "مقدمة في علم الخلية والوراثة",
      price: "190.00", level: "intermediate" as const, language: "ar",
      categoryId: bioCat.id, teacherId: t2.id, isPublished: true,
    },
  ]).returning().onConflictDoNothing();
  console.log(`Inserted ${courses.length} courses`);

  // ── Deep-seed the Algebra course (sections + lessons + slides + quizzes) ─────
  const algebraCourse = courses.find(c => c.title === "Algebra Fundamentals");
  if (!algebraCourse) { console.log("Algebra course not found, skipping deep seed"); return; }

  // Sections
  const sections = await db.insert(sectionsTable).values([
    {
      courseId: algebraCourse.id, order: 1,
      title: "Introduction to Algebra",        titleAr: "مقدمة في الجبر",
      description: "Learn the core concepts of algebra",
      descriptionAr: "تعلّم المفاهيم الأساسية للجبر",
    },
    {
      courseId: algebraCourse.id, order: 2,
      title: "Linear Equations",               titleAr: "المعادلات الخطية",
      description: "Solving linear equations step by step",
      descriptionAr: "حل المعادلات الخطية خطوة بخطوة",
    },
    {
      courseId: algebraCourse.id, order: 3,
      title: "Quadratic Equations",            titleAr: "المعادلات التربيعية",
      description: "Factoring and the quadratic formula",
      descriptionAr: "التحليل وقانون الدرجة الثانية",
    },
    {
      courseId: algebraCourse.id, order: 4,
      title: "Systems of Equations",           titleAr: "أنظمة المعادلات",
      description: "Solving multiple equations simultaneously",
      descriptionAr: "حل عدة معادلات في آنٍ واحد",
    },
  ]).returning();
  console.log(`Inserted ${sections.length} sections`);

  const [secIntro, secLinear, secQuad, secSystems] = sections;

  // ── Section 1 Lessons ─────────────────────────────────────────────────────────
  const introLessons = await db.insert(lessonsTable).values([
    {
      courseId: algebraCourse.id, sectionId: secIntro.id, order: 1,
      title: "What is Algebra?",               titleAr: "ما هو الجبر؟",
      content: "Algebra is the branch of mathematics dealing with symbols and the rules for manipulating those symbols.",
      contentAr: "الجبر هو فرع الرياضيات الذي يتعامل مع الرموز وقواعد معالجتها.",
      notes: "Key point: Variables represent unknown values. Always think of algebra as generalised arithmetic.",
      notesAr: "نقطة رئيسية: المتغيرات تمثل قيمًا مجهولة. فكّر دائمًا في الجبر كحساب معمّم.",
      duration: 20, isFree: true, type: "video" as const,
    },
    {
      courseId: algebraCourse.id, sectionId: secIntro.id, order: 2,
      title: "Variables and Expressions",      titleAr: "المتغيرات والتعبيرات",
      content: "An algebraic expression contains variables, constants, and operations.",
      contentAr: "يحتوي التعبير الجبري على متغيرات وثوابت وعمليات.",
      notes: "Remember: 3x means 3 multiplied by x. Like terms can be combined.",
      notesAr: "تذكّر: 3x تعني 3 مضروبًا في x. الحدود المتشابهة يمكن جمعها.",
      duration: 30, isFree: true, type: "video" as const,
    },
    {
      courseId: algebraCourse.id, sectionId: secIntro.id, order: 3,
      title: "Order of Operations",            titleAr: "ترتيب العمليات",
      content: "PEMDAS: Parentheses, Exponents, Multiplication/Division, Addition/Subtraction.",
      contentAr: "PEMDAS: الأقواس، الأسس، الضرب/القسمة، الجمع/الطرح.",
      notes: "Always solve inside parentheses first. Exponents come before multiplication.",
      notesAr: "احلّ ما بين الأقواس أولًا. الأسس تأتي قبل الضرب.",
      duration: 25, isFree: false, type: "video" as const,
    },
  ]).returning();

  // Slides for lesson 1
  const l1 = introLessons[0];
  await db.insert(slidesTable).values([
    {
      lessonId: l1.id, order: 1,
      title: "What is Algebra?",               titleAr: "ما هو الجبر؟",
      content: "Algebra is a branch of mathematics using letters and symbols to represent numbers and quantities in formulas and equations.",
      contentAr: "الجبر فرع من الرياضيات يستخدم الحروف والرموز لتمثيل الأعداد والكميات في الصيغ والمعادلات.",
    },
    {
      lessonId: l1.id, order: 2,
      title: "History of Algebra",             titleAr: "تاريخ الجبر",
      content: "The word 'Algebra' comes from Arabic: 'Al-Jabr', coined by Muhammad ibn Musa al-Khwarizmi in the 9th century.",
      contentAr: "كلمة 'الجبر' عربية الأصل، ابتكرها محمد بن موسى الخوارزمي في القرن التاسع الميلادي.",
    },
    {
      lessonId: l1.id, order: 3,
      title: "Why Learn Algebra?",             titleAr: "لماذا نتعلّم الجبر؟",
      content: "Algebra is the foundation for calculus, physics, engineering, economics, and computer science.",
      contentAr: "الجبر هو الأساس للتفاضل والتكامل والفيزياء والهندسة والاقتصاد وعلوم الحاسوب.",
    },
  ]);

  // Quiz for Section 1
  const [quiz1] = await db.insert(quizzesTable).values({
    courseId: algebraCourse.id,
    title: "Introduction Quiz",               titleAr: "اختبار المقدمة",
    description: "Test your understanding of algebra basics",
    descriptionAr: "اختبر فهمك لأساسيات الجبر",
    type: "lesson" as const, passingScore: 60, timeLimitMinutes: 10,
  }).returning();

  const s1q1 = await db.insert(quizQuestionsTable).values({
    quizId: quiz1.id, order: 1, points: 1,
    question: "What does a variable represent in algebra?",
    questionAr: "ماذا يمثل المتغير في الجبر؟",
    type: "multiple_choice" as const,
    explanation: "A variable is a symbol (usually a letter) that represents an unknown or changeable value.",
    explanationAr: "المتغير رمز (عادةً حرف) يمثل قيمة مجهولة أو قابلة للتغيير.",
  }).returning();

  await db.insert(quizOptionsTable).values([
    { questionId: s1q1[0].id, order: 1, text: "A fixed number",               textAr: "عدد ثابت",                   isCorrect: false },
    { questionId: s1q1[0].id, order: 2, text: "An unknown or changing value",  textAr: "قيمة مجهولة أو متغيرة",      isCorrect: true },
    { questionId: s1q1[0].id, order: 3, text: "A mathematical operation",      textAr: "عملية رياضية",               isCorrect: false },
    { questionId: s1q1[0].id, order: 4, text: "A type of equation",            textAr: "نوع من المعادلات",           isCorrect: false },
  ]);

  const s1q2 = await db.insert(quizQuestionsTable).values({
    quizId: quiz1.id, order: 2, points: 1,
    question: "Which of the following is an algebraic expression?",
    questionAr: "أيٌّ مما يلي تعبيرٌ جبري؟",
    type: "multiple_choice" as const,
    explanation: "3x + 5 contains a variable (x) and a constant (5) joined by addition — making it an algebraic expression.",
    explanationAr: "3x + 5 يحتوي على متغير (x) وثابت (5) مرتبطان بالجمع — مما يجعله تعبيرًا جبريًا.",
  }).returning();

  await db.insert(quizOptionsTable).values([
    { questionId: s1q2[0].id, order: 1, text: "5 + 3 = 8",    textAr: "5 + 3 = 8",    isCorrect: false },
    { questionId: s1q2[0].id, order: 2, text: "3x + 5",       textAr: "3x + 5",       isCorrect: true  },
    { questionId: s1q2[0].id, order: 3, text: "100",           textAr: "100",           isCorrect: false },
    { questionId: s1q2[0].id, order: 4, text: "2 × 4",        textAr: "2 × 4",        isCorrect: false },
  ]);

  const s1q3 = await db.insert(quizQuestionsTable).values({
    quizId: quiz1.id, order: 3, points: 1,
    question: "In PEMDAS, which operation is performed first?",
    questionAr: "في قاعدة PEMDAS، أيّ عملية تُنفَّذ أولًا؟",
    type: "multiple_choice" as const,
    explanation: "P stands for Parentheses — always solve what's inside brackets first.",
    explanationAr: "P تعني الأقواس — احلّ دائمًا ما بداخل الأقواس أولًا.",
  }).returning();

  await db.insert(quizOptionsTable).values([
    { questionId: s1q3[0].id, order: 1, text: "Addition",      textAr: "الجمع",       isCorrect: false },
    { questionId: s1q3[0].id, order: 2, text: "Exponents",     textAr: "الأسس",       isCorrect: false },
    { questionId: s1q3[0].id, order: 3, text: "Parentheses",   textAr: "الأقواس",     isCorrect: true  },
    { questionId: s1q3[0].id, order: 4, text: "Multiplication", textAr: "الضرب",      isCorrect: false },
  ]);
  console.log("Section 1 quiz OK");

  // ── Section 2 Lessons ─────────────────────────────────────────────────────────
  const linearLessons = await db.insert(lessonsTable).values([
    {
      courseId: algebraCourse.id, sectionId: secLinear.id, order: 1,
      title: "What is a Linear Equation?",    titleAr: "ما هي المعادلة الخطية؟",
      content: "A linear equation is an equation between two variables that gives a straight line when plotted on a graph.",
      contentAr: "المعادلة الخطية معادلة بين متغيرين تعطي خطًا مستقيمًا عند رسمها على رسم بياني.",
      notes: "Standard form: ax + b = c. The goal is to isolate x on one side.",
      notesAr: "الصيغة القياسية: ax + b = c. الهدف هو عزل x على أحد الطرفين.",
      duration: 35, isFree: false, type: "video" as const,
    },
    {
      courseId: algebraCourse.id, sectionId: secLinear.id, order: 2,
      title: "Solving One-Step Equations",    titleAr: "حل معادلات خطوة واحدة",
      content: "Use inverse operations to isolate the variable. Whatever you do to one side, do to the other.",
      contentAr: "استخدم العمليات العكسية لعزل المتغير. ما تفعله لأحد الطرفين افعله للآخر.",
      notes: "If x + 5 = 12, subtract 5 from both sides: x = 7.",
      notesAr: "إذا كانت x + 5 = 12، اطرح 5 من الطرفين: x = 7.",
      duration: 40, isFree: false, type: "video" as const,
    },
    {
      courseId: algebraCourse.id, sectionId: secLinear.id, order: 3,
      title: "Solving Two-Step Equations",    titleAr: "حل معادلات خطوتين",
      content: "Two-step equations require two operations to solve. First add or subtract, then multiply or divide.",
      contentAr: "تتطلب معادلات الخطوتين عمليتين للحل. أولًا الجمع أو الطرح، ثم الضرب أو القسمة.",
      notes: "For 2x + 3 = 11: step 1 subtract 3 → 2x = 8, step 2 divide by 2 → x = 4.",
      notesAr: "لـ 2x + 3 = 11: الخطوة 1 اطرح 3 → 2x = 8، الخطوة 2 اقسم على 2 → x = 4.",
      duration: 45, isFree: false, type: "video" as const,
    },
  ]).returning();

  // Slides for lesson 4
  const l4 = linearLessons[0];
  await db.insert(slidesTable).values([
    {
      lessonId: l4.id, order: 1,
      title: "Definition",                     titleAr: "التعريف",
      content: "A linear equation has one or two variables, and the highest power of any variable is 1.",
      contentAr: "المعادلة الخطية تحتوي على متغير أو متغيرين، وأعلى قوة لأي متغير هي 1.",
    },
    {
      lessonId: l4.id, order: 2,
      title: "Graph of a Linear Equation",     titleAr: "رسم المعادلة الخطية",
      content: "When plotted on a coordinate plane, a linear equation always forms a straight line.",
      contentAr: "عند رسمها على مستوى إحداثي، تُشكّل المعادلة الخطية دائمًا خطًا مستقيمًا.",
    },
  ]);

  // Quiz for Section 2
  const [quiz2] = await db.insert(quizzesTable).values({
    courseId: algebraCourse.id,
    title: "Linear Equations Quiz",           titleAr: "اختبار المعادلات الخطية",
    description: "Test your ability to solve linear equations",
    descriptionAr: "اختبر قدرتك على حل المعادلات الخطية",
    type: "lesson" as const, passingScore: 70, timeLimitMinutes: 15,
  }).returning();

  const s2q1 = await db.insert(quizQuestionsTable).values({
    quizId: quiz2.id, order: 1, points: 2,
    question: "Solve for x: x + 7 = 15",
    questionAr: "أوجد قيمة x: x + 7 = 15",
    type: "multiple_choice" as const,
    explanation: "Subtract 7 from both sides: x = 15 - 7 = 8",
    explanationAr: "اطرح 7 من الطرفين: x = 15 - 7 = 8",
  }).returning();

  await db.insert(quizOptionsTable).values([
    { questionId: s2q1[0].id, order: 1, text: "x = 6",  textAr: "x = 6",  isCorrect: false },
    { questionId: s2q1[0].id, order: 2, text: "x = 8",  textAr: "x = 8",  isCorrect: true  },
    { questionId: s2q1[0].id, order: 3, text: "x = 22", textAr: "x = 22", isCorrect: false },
    { questionId: s2q1[0].id, order: 4, text: "x = 7",  textAr: "x = 7",  isCorrect: false },
  ]);

  const s2q2 = await db.insert(quizQuestionsTable).values({
    quizId: quiz2.id, order: 2, points: 2,
    question: "Solve for x: 3x = 18",
    questionAr: "أوجد قيمة x: 3x = 18",
    type: "multiple_choice" as const,
    explanation: "Divide both sides by 3: x = 18 / 3 = 6",
    explanationAr: "اقسم الطرفين على 3: x = 18 / 3 = 6",
  }).returning();

  await db.insert(quizOptionsTable).values([
    { questionId: s2q2[0].id, order: 1, text: "x = 3",  textAr: "x = 3",  isCorrect: false },
    { questionId: s2q2[0].id, order: 2, text: "x = 54", textAr: "x = 54", isCorrect: false },
    { questionId: s2q2[0].id, order: 3, text: "x = 6",  textAr: "x = 6",  isCorrect: true  },
    { questionId: s2q2[0].id, order: 4, text: "x = 15", textAr: "x = 15", isCorrect: false },
  ]);

  const s2q3 = await db.insert(quizQuestionsTable).values({
    quizId: quiz2.id, order: 3, points: 3,
    question: "Solve for x: 2x + 4 = 16",
    questionAr: "أوجد قيمة x: 2x + 4 = 16",
    type: "multiple_choice" as const,
    explanation: "Step 1: subtract 4 from both sides → 2x = 12. Step 2: divide both sides by 2 → x = 6",
    explanationAr: "الخطوة 1: اطرح 4 من الطرفين → 2x = 12. الخطوة 2: اقسم الطرفين على 2 → x = 6",
  }).returning();

  await db.insert(quizOptionsTable).values([
    { questionId: s2q3[0].id, order: 1, text: "x = 4",  textAr: "x = 4",  isCorrect: false },
    { questionId: s2q3[0].id, order: 2, text: "x = 10", textAr: "x = 10", isCorrect: false },
    { questionId: s2q3[0].id, order: 3, text: "x = 6",  textAr: "x = 6",  isCorrect: true  },
    { questionId: s2q3[0].id, order: 4, text: "x = 8",  textAr: "x = 8",  isCorrect: false },
  ]);
  console.log("Section 2 quiz OK");

  // ── Section 3 Lessons ─────────────────────────────────────────────────────────
  await db.insert(lessonsTable).values([
    {
      courseId: algebraCourse.id, sectionId: secQuad.id, order: 1,
      title: "Introduction to Quadratics",    titleAr: "مقدمة في المعادلات التربيعية",
      content: "A quadratic equation is a second-order polynomial equation in the form ax² + bx + c = 0.",
      contentAr: "المعادلة التربيعية معادلة متعددة الحدود من الدرجة الثانية بالشكل ax² + bx + c = 0.",
      notes: "The parabola opens upward when a > 0 and downward when a < 0.",
      notesAr: "القطع المكافئ ينفتح للأعلى عندما a > 0 وللأسفل عندما a < 0.",
      duration: 50, isFree: false, type: "video" as const,
    },
    {
      courseId: algebraCourse.id, sectionId: secQuad.id, order: 2,
      title: "The Quadratic Formula",         titleAr: "قانون الدرجة الثانية",
      content: "x = (-b ± √(b²-4ac)) / 2a — this formula solves any quadratic equation.",
      contentAr: "x = (-b ± √(b²-4ac)) / 2a — يحل هذا القانون أي معادلة تربيعية.",
      notes: "The discriminant (b²-4ac) tells you how many real solutions exist: >0 two solutions, =0 one solution, <0 no real solutions.",
      notesAr: "المميز (b²-4ac) يخبرك بعدد الحلول الحقيقية: >0 حلان، =0 حل واحد، <0 لا حلول حقيقية.",
      duration: 55, isFree: false, type: "video" as const,
    },
    {
      courseId: algebraCourse.id, sectionId: secQuad.id, order: 3,
      title: "Factoring Quadratics",          titleAr: "تحليل المعادلات التربيعية",
      content: "Factoring means rewriting ax² + bx + c as a product of two binomials: (x + p)(x + q).",
      contentAr: "التحليل يعني إعادة كتابة ax² + bx + c كحاصل ضرب ثنائيين: (x + p)(x + q).",
      notes: "Look for two numbers that multiply to give c and add to give b.",
      notesAr: "ابحث عن عددين حاصل ضربهما = c وحاصل جمعهما = b.",
      duration: 60, isFree: false, type: "video" as const,
    },
  ]).returning();

  // Quiz for Section 3
  const [quiz3] = await db.insert(quizzesTable).values({
    courseId: algebraCourse.id,
    title: "Quadratic Equations Quiz",        titleAr: "اختبار المعادلات التربيعية",
    description: "Test your understanding of quadratic equations",
    descriptionAr: "اختبر فهمك للمعادلات التربيعية",
    type: "lesson" as const, passingScore: 70, timeLimitMinutes: 20,
  }).returning();

  const s3q1 = await db.insert(quizQuestionsTable).values({
    quizId: quiz3.id, order: 1, points: 2,
    question: "What is the standard form of a quadratic equation?",
    questionAr: "ما هي الصيغة القياسية للمعادلة التربيعية؟",
    type: "multiple_choice" as const,
    explanation: "The standard form is ax² + bx + c = 0 where a ≠ 0.",
    explanationAr: "الصيغة القياسية هي ax² + bx + c = 0 حيث a ≠ 0.",
  }).returning();

  await db.insert(quizOptionsTable).values([
    { questionId: s3q1[0].id, order: 1, text: "ax + b = 0",         textAr: "ax + b = 0",         isCorrect: false },
    { questionId: s3q1[0].id, order: 2, text: "ax² + bx + c = 0",   textAr: "ax² + bx + c = 0",   isCorrect: true  },
    { questionId: s3q1[0].id, order: 3, text: "ax³ + bx² + c = 0",  textAr: "ax³ + bx² + c = 0",  isCorrect: false },
    { questionId: s3q1[0].id, order: 4, text: "a/x + b = 0",        textAr: "a/x + b = 0",        isCorrect: false },
  ]);

  const s3q2 = await db.insert(quizQuestionsTable).values({
    quizId: quiz3.id, order: 2, points: 2,
    question: "If the discriminant (b²-4ac) is negative, how many real solutions are there?",
    questionAr: "إذا كان المميز (b²-4ac) سالبًا، كم عدد الحلول الحقيقية؟",
    type: "multiple_choice" as const,
    explanation: "A negative discriminant means there are no real solutions — only complex/imaginary solutions.",
    explanationAr: "المميز السالب يعني عدم وجود حلول حقيقية — فقط حلول مركبة/تخيلية.",
  }).returning();

  await db.insert(quizOptionsTable).values([
    { questionId: s3q2[0].id, order: 1, text: "Two real solutions",   textAr: "حلان حقيقيان",         isCorrect: false },
    { questionId: s3q2[0].id, order: 2, text: "One real solution",    textAr: "حل حقيقي واحد",       isCorrect: false },
    { questionId: s3q2[0].id, order: 3, text: "No real solutions",    textAr: "لا حلول حقيقية",      isCorrect: true  },
    { questionId: s3q2[0].id, order: 4, text: "Infinite solutions",   textAr: "حلول لا نهائية",      isCorrect: false },
  ]);
  console.log("Section 3 quiz OK");

  // ── Section 4 Lessons ─────────────────────────────────────────────────────────
  await db.insert(lessonsTable).values([
    {
      courseId: algebraCourse.id, sectionId: secSystems.id, order: 1,
      title: "Introduction to Systems",       titleAr: "مقدمة في أنظمة المعادلات",
      content: "A system of equations is a set of two or more equations with the same variables.",
      contentAr: "نظام المعادلات مجموعة من معادلتين أو أكثر تحتوي على نفس المتغيرات.",
      notes: "A solution to a system must satisfy ALL equations simultaneously.",
      notesAr: "الحل لنظام معادلات يجب أن يحقق جميع المعادلات في آنٍ واحد.",
      duration: 40, isFree: false, type: "video" as const,
    },
    {
      courseId: algebraCourse.id, sectionId: secSystems.id, order: 2,
      title: "Substitution Method",           titleAr: "طريقة الإحلال",
      content: "Solve one equation for one variable, then substitute into the other equation.",
      contentAr: "أوجد قيمة متغير واحد من إحدى المعادلتين، ثم عوّض في المعادلة الأخرى.",
      notes: "Best used when one equation is already solved for a variable, e.g. y = 2x + 1.",
      notesAr: "تُستخدم بشكل أفضل عندما تكون إحدى المعادلتين محلولة مسبقًا لمتغير، مثل y = 2x + 1.",
      duration: 45, isFree: false, type: "video" as const,
    },
  ]).returning();

  // ── Final Course Quiz ─────────────────────────────────────────────────────────
  const [finalQuiz] = await db.insert(quizzesTable).values({
    courseId: algebraCourse.id,
    title: "Algebra Fundamentals — Final Exam",
    titleAr: "أساسيات الجبر — الاختبار النهائي",
    description: "Comprehensive test covering all sections of the course",
    descriptionAr: "اختبار شامل يغطي جميع أقسام الدورة",
    type: "final" as const, passingScore: 75, timeLimitMinutes: 45,
  }).returning();

  const fqData = [
    {
      question: "What does a variable represent?",
      questionAr: "ماذا يمثل المتغير؟",
      explanation: "A variable represents an unknown or changing value.",
      explanationAr: "المتغير يمثل قيمة مجهولة أو متغيرة.",
      options: [
        { text: "A fixed number",              textAr: "عدد ثابت",               isCorrect: false },
        { text: "An unknown or changing value", textAr: "قيمة مجهولة أو متغيرة", isCorrect: true  },
        { text: "A mathematical operation",    textAr: "عملية رياضية",            isCorrect: false },
      ],
    },
    {
      question: "Solve: x - 9 = 3",
      questionAr: "حل: x - 9 = 3",
      explanation: "Add 9 to both sides: x = 12.",
      explanationAr: "أضف 9 للطرفين: x = 12.",
      options: [
        { text: "x = 6",  textAr: "x = 6",  isCorrect: false },
        { text: "x = 12", textAr: "x = 12", isCorrect: true  },
        { text: "x = -6", textAr: "x = -6", isCorrect: false },
        { text: "x = 27", textAr: "x = 27", isCorrect: false },
      ],
    },
    {
      question: "Solve: 4x = 20",
      questionAr: "حل: 4x = 20",
      explanation: "Divide both sides by 4: x = 5.",
      explanationAr: "اقسم الطرفين على 4: x = 5.",
      options: [
        { text: "x = 4",  textAr: "x = 4",  isCorrect: false },
        { text: "x = 80", textAr: "x = 80", isCorrect: false },
        { text: "x = 5",  textAr: "x = 5",  isCorrect: true  },
        { text: "x = 16", textAr: "x = 16", isCorrect: false },
      ],
    },
    {
      question: "Which equation is quadratic?",
      questionAr: "أيٌّ من المعادلات الآتية تربيعية؟",
      explanation: "A quadratic equation contains a squared variable (x²).",
      explanationAr: "المعادلة التربيعية تحتوي على متغير مربّع (x²).",
      options: [
        { text: "3x + 2 = 0",     textAr: "3x + 2 = 0",     isCorrect: false },
        { text: "x² - 5x + 6 = 0",textAr: "x² - 5x + 6 = 0",isCorrect: true  },
        { text: "2x - 7 = 1",     textAr: "2x - 7 = 1",     isCorrect: false },
        { text: "x/2 = 4",        textAr: "x/2 = 4",        isCorrect: false },
      ],
    },
    {
      question: "Solve: 5x + 10 = 35",
      questionAr: "حل: 5x + 10 = 35",
      explanation: "Subtract 10: 5x = 25, then divide by 5: x = 5.",
      explanationAr: "اطرح 10: 5x = 25، ثم اقسم على 5: x = 5.",
      options: [
        { text: "x = 3",  textAr: "x = 3",  isCorrect: false },
        { text: "x = 5",  textAr: "x = 5",  isCorrect: true  },
        { text: "x = 45", textAr: "x = 45", isCorrect: false },
        { text: "x = 9",  textAr: "x = 9",  isCorrect: false },
      ],
    },
  ];

  for (let i = 0; i < fqData.length; i++) {
    const d = fqData[i];
    const [fq] = await db.insert(quizQuestionsTable).values({
      quizId: finalQuiz.id, order: i + 1, points: 2,
      question: d.question, questionAr: d.questionAr,
      type: "multiple_choice" as const,
      explanation: d.explanation, explanationAr: d.explanationAr,
    }).returning();
    await db.insert(quizOptionsTable).values(
      d.options.map((o, oi) => ({ questionId: fq.id, order: oi + 1, text: o.text, textAr: o.textAr, isCorrect: o.isCorrect }))
    );
  }
  console.log("Final quiz OK");

  // ── Enroll students in Algebra course ────────────────────────────────────────
  const s1 = allStudents.find(s => s.email === "student@lms.ly");
  const s2 = allStudents.find(s => s.email === "sara@lms.ly");

  if (s1) {
    await db.insert(enrollmentsTable).values({
      userId: s1.id, courseId: algebraCourse.id,
      progress: "35.00",
    }).onConflictDoNothing();
  }
  if (s2) {
    await db.insert(enrollmentsTable).values({
      userId: s2.id, courseId: algebraCourse.id,
      progress: "70.00",
    }).onConflictDoNothing();
  }
  console.log("Enrollments OK");

  // ── Live sessions ─────────────────────────────────────────────────────────────
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek  = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);

  await db.insert(liveSessionsTable).values([
    {
      teacherId: t1.id,
      title: "Live Q&A: Algebra Problems",    titleAr: "جلسة مباشرة: أسئلة الجبر",
      description: "Live session to solve algebra problems",
      scheduledAt: tomorrow, durationMinutes: 90, maxParticipants: 50,
      meetingUrl: "lms-libya-algebra-qa",
      status: "scheduled" as const,
    },
    {
      teacherId: t2.id,
      title: "Physics Lab: Experiments",      titleAr: "مختبر الفيزياء: التجارب",
      description: "Virtual physics lab demonstration",
      scheduledAt: nextWeek, durationMinutes: 120, maxParticipants: 30,
      meetingUrl: "lms-libya-physics-lab",
      status: "scheduled" as const,
    },
  ]).onConflictDoNothing();
  console.log("Live sessions OK");

  // ── Tutoring Listings ─────────────────────────────────────────────────────────
  await db.insert(tutoringListingsTable).values([
    {
      teacherId: t1.id,
      title: "Algebra & Calculus — Secondary Level",
      titleAr: "الجبر وحساب التفاضل والتكامل — المرحلة الثانوية",
      subject: "Mathematics",
      subjectAr: "الرياضيات",
      gradeLevel: "secondary",
      gradeLevelAr: "المرحلة الثانوية",
      description: "Expert algebra and calculus tutoring for secondary and university students. 15 years experience.",
      descriptionAr: "دروس خصوصية متخصصة في الجبر وحساب التفاضل والتكامل للمرحلة الثانوية والجامعية. خبرة 15 عامًا.",
      hourlyRate: "50.00",
      currency: "LYD",
      availableDays: "Mon,Tue,Wed,Thu,Fri",
      availableTimeFrom: "16:00",
      availableTimeTo: "21:00",
      maxStudents: 3,
      sessionDurationMinutes: 60,
      status: "active" as const,
    },
    {
      teacherId: t2.id,
      title: "Physics — University Level",
      titleAr: "الفيزياء — المرحلة الجامعية",
      subject: "Physics",
      subjectAr: "الفيزياء",
      gradeLevel: "university",
      gradeLevelAr: "المرحلة الجامعية",
      description: "Physics tutoring with practical lab demonstrations. Covering mechanics, electromagnetism, and optics.",
      descriptionAr: "دروس فيزياء مع عروض مختبرية عملية. تشمل الميكانيكا والكهرومغناطيسية والبصريات.",
      hourlyRate: "75.00",
      currency: "LYD",
      availableDays: "Sat,Sun",
      availableTimeFrom: "18:00",
      availableTimeTo: "22:00",
      maxStudents: 2,
      sessionDurationMinutes: 90,
      status: "active" as const,
    },
    {
      teacherId: t1.id,
      title: "Mathematics — Middle School",
      titleAr: "الرياضيات — المرحلة المتوسطة",
      subject: "Mathematics",
      subjectAr: "الرياضيات",
      gradeLevel: "middle",
      gradeLevelAr: "المرحلة المتوسطة",
      description: "Middle school math made easy! Fractions, geometry, and basic algebra.",
      descriptionAr: "رياضيات المتوسطة بطريقة سهلة! كسور وهندسة وجبر أساسي.",
      hourlyRate: "35.00",
      currency: "LYD",
      availableDays: "Sat,Sun",
      availableTimeFrom: "10:00",
      availableTimeTo: "14:00",
      maxStudents: 5,
      sessionDurationMinutes: 45,
      status: "active" as const,
    },
  ]).onConflictDoNothing();
  console.log("Tutoring listings OK");

  console.log("✅ Seeding complete!");
}

seed().catch(console.error);
