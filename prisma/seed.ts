import { PrismaClient, UserRole, PostType, PostCategory } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create Admin user
  const admin = await prisma.user.upsert({
    where: { studentId: "000000001" },
    update: {},
    create: {
      studentId: "000000001",
      email: "admin@university.edu",
      fullName: "CITSA Admin",
      bio: "Official CITSA Administrator",
      role: UserRole.ADMIN,
      isVerified: true,
      program: "Computer Science",
      classYear: "2024",
      skills: JSON.stringify([
        "Administration",
        "Event Management",
        "Communication",
      ]),
      interests: JSON.stringify([
        "Technology",
        "Leadership",
        "Community Building",
      ]),
    },
  });
  console.log("✅ Admin user created:", admin.fullName);

  // Create Class Rep user
  const classRep = await prisma.user.upsert({
    where: { studentId: "000000002" },
    update: {},
    create: {
      studentId: "000000002",
      email: "000000002@university.edu",
      fullName: "John Doe",
      bio: "Class Representative for 3rd Year Computer Science",
      role: UserRole.CLASS_REP,
      isVerified: true,
      program: "Computer Science",
      classYear: "2025",
      skills: JSON.stringify(["Python", "JavaScript", "Leadership"]),
      interests: JSON.stringify(["AI", "Web Development", "Student Affairs"]),
    },
  });
  console.log("✅ Class Rep created:", classRep.fullName);

  // Create sample Groups
  const groups = await Promise.all([
    prisma.group.upsert({
      where: { id: "group-dev-club" },
      update: {},
      create: {
        id: "group-dev-club",
        name: "Developer Club",
        description:
          "A community of passionate developers building awesome projects together.",
        category: "Technology",
        coverColor: "#3B82F6",
        membersCount: 0,
      },
    }),
    prisma.group.upsert({
      where: { id: "group-ai-society" },
      update: {},
      create: {
        id: "group-ai-society",
        name: "AI & ML Society",
        description:
          "Exploring artificial intelligence, machine learning, and data science.",
        category: "Technology",
        coverColor: "#8B5CF6",
        membersCount: 0,
      },
    }),
    prisma.group.upsert({
      where: { id: "group-cyber-security" },
      update: {},
      create: {
        id: "group-cyber-security",
        name: "Cybersecurity Club",
        description:
          "Learn about ethical hacking, network security, and cybersecurity best practices.",
        category: "Technology",
        coverColor: "#EF4444",
        membersCount: 0,
      },
    }),
    prisma.group.upsert({
      where: { id: "group-women-in-tech" },
      update: {},
      create: {
        id: "group-women-in-tech",
        name: "Women in Tech",
        description: "Supporting and empowering women in technology fields.",
        category: "Community",
        coverColor: "#EC4899",
        membersCount: 0,
      },
    }),
    prisma.group.upsert({
      where: { id: "group-gaming" },
      update: {},
      create: {
        id: "group-gaming",
        name: "Gaming & Esports",
        description:
          "For gamers and esports enthusiasts. Join tournaments and gaming sessions!",
        category: "Entertainment",
        coverColor: "#10B981",
        membersCount: 0,
      },
    }),
  ]);
  console.log(`✅ Created ${groups.length} groups`);

  // Create sample Classroom
  const classroom = await prisma.classroom.upsert({
    where: { id: "classroom-cs-2025" },
    update: {},
    create: {
      id: "classroom-cs-2025",
      yearGroup: "3rd Year",
      graduationYear: "2025",
      semester: "First Semester 2025/2026",
      isActive: true,
    },
  });
  console.log("✅ Classroom created:", classroom.yearGroup);

  // Create sample Courses
  const courses = await Promise.all([
    prisma.course.upsert({
      where: { id: "course-cs301" },
      update: {},
      create: {
        id: "course-cs301",
        classroomId: classroom.id,
        courseCode: "CS301",
        courseName: "Data Structures & Algorithms",
        credits: 3,
      },
    }),
    prisma.course.upsert({
      where: { id: "course-cs302" },
      update: {},
      create: {
        id: "course-cs302",
        classroomId: classroom.id,
        courseCode: "CS302",
        courseName: "Software Engineering",
        credits: 3,
      },
    }),
    prisma.course.upsert({
      where: { id: "course-cs303" },
      update: {},
      create: {
        id: "course-cs303",
        classroomId: classroom.id,
        courseCode: "CS303",
        courseName: "Database Systems",
        credits: 3,
      },
    }),
  ]);
  console.log(`✅ Created ${courses.length} courses`);

  // Create Timetable slots
  const timetableSlots = await Promise.all([
    prisma.timetableSlot.upsert({
      where: { id: "slot-mon-cs301" },
      update: {},
      create: {
        id: "slot-mon-cs301",
        classroomId: classroom.id,
        courseId: courses[0].id,
        dayOfWeek: "Monday",
        startTime: "09:00",
        endTime: "11:00",
        room: "LT 101",
      },
    }),
    prisma.timetableSlot.upsert({
      where: { id: "slot-tue-cs302" },
      update: {},
      create: {
        id: "slot-tue-cs302",
        classroomId: classroom.id,
        courseId: courses[1].id,
        dayOfWeek: "Tuesday",
        startTime: "14:00",
        endTime: "16:00",
        room: "LT 102",
      },
    }),
    prisma.timetableSlot.upsert({
      where: { id: "slot-wed-cs303" },
      update: {},
      create: {
        id: "slot-wed-cs303",
        classroomId: classroom.id,
        courseId: courses[2].id,
        dayOfWeek: "Wednesday",
        startTime: "10:00",
        endTime: "12:00",
        room: "Lab 201",
      },
    }),
  ]);
  console.log(`✅ Created ${timetableSlots.length} timetable slots`);

  // Create sample Posts
  const posts = await Promise.all([
    prisma.post.upsert({
      where: { id: "post-welcome" },
      update: {},
      create: {
        id: "post-welcome",
        authorId: admin.id,
        type: PostType.ANNOUNCEMENT,
        category: PostCategory.POSITIVE_NEWS,
        title: "Welcome to CITSA App! 🎉",
        content:
          "We are excited to launch the official CITSA mobile app! Stay connected with your fellow Computer and IT students, register for events, and never miss an announcement.",
        isPinned: true,
        isPublished: true,
      },
    }),
    prisma.post.upsert({
      where: { id: "post-hackathon" },
      update: {},
      create: {
        id: "post-hackathon",
        authorId: admin.id,
        type: PostType.EVENT,
        category: PostCategory.EVENTS,
        title: "CITSA Hackathon 2026",
        content:
          "Join us for the biggest hackathon of the year! Build innovative solutions, compete for prizes, and network with industry professionals. Teams of 2-4 students welcome.",
        isPublished: true,
      },
    }),
    prisma.post.upsert({
      where: { id: "post-internship" },
      update: {},
      create: {
        id: "post-internship",
        authorId: admin.id,
        type: PostType.OPPORTUNITY,
        category: PostCategory.OPPORTUNITY,
        title: "Software Engineering Internship at TechCorp",
        content:
          "TechCorp is hiring summer interns for their engineering team. Great opportunity for 2nd and 3rd year students. Apply by February 28, 2026.",
        isPublished: true,
      },
    }),
  ]);
  console.log(`✅ Created ${posts.length} posts`);

  // Create Event for the hackathon post
  const hackathonPost = posts.find((p) => p.id === "post-hackathon");
  if (hackathonPost) {
    await prisma.event.upsert({
      where: { id: "event-hackathon" },
      update: {},
      create: {
        id: "event-hackathon",
        postId: hackathonPost.id,
        eventDate: new Date("2026-03-15"),
        eventTime: "09:00 AM - 09:00 PM",
        location: "Main Auditorium, Block A",
        capacityMax: 100,
        capacityCurrent: 0,
        registrationDeadline: new Date("2026-03-10"),
        tags: JSON.stringify([
          "Hackathon",
          "Coding",
          "Competition",
          "Networking",
        ]),
        isUrgent: false,
      },
    });
    console.log("✅ Hackathon event created");
  }

  console.log("");
  console.log("🎉 Database seed completed successfully!");
  console.log("");
  console.log("📋 Summary:");
  console.log("   - 1 Admin user (studentId: 000000001)");
  console.log("   - 1 Class Rep user (studentId: 000000002)");
  console.log(`   - ${groups.length} groups`);
  console.log("   - 1 classroom with courses and timetable");
  console.log(`   - ${posts.length} posts (including 1 event)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
