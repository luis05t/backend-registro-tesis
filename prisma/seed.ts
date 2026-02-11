import * as bcrypt from "bcryptjs";
import { config } from "dotenv";
// Importamos el cliente generado
import { PrismaClient } from '../src/prisma/generated/client';
// Importamos las librerías necesarias para el adaptador
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import "dotenv/config";

// Cargar variables de entorno
config();

// 1. Configurar la conexión (Igual que en tu PrismaService)
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ 
    connectionString,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20
});

const adapter = new PrismaPg(pool);

// 2. Instanciar PrismaClient pasando el adaptador (Esto soluciona el error)
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🌱 Starting seed...");

    // Limpiar la base de datos
    console.log("🧹 Cleaning database...");
    try {
        await prisma.userProject.deleteMany();
        await prisma.projectSkills.deleteMany();
        await prisma.project.deleteMany();
        await prisma.skills.deleteMany(); 
        await prisma.user.deleteMany();
        await prisma.rolePermission.deleteMany();
        await prisma.permission.deleteMany();
        await prisma.role.deleteMany();
        await prisma.career.deleteMany();
        await prisma.period.deleteMany(); // Agregado por si acaso
    } catch (error) {
        console.log("⚠️  Database might be already clean or tables missing.");
    }

    // ========== ROLES ==========
    console.log("👥 Creating roles...");
    const adminRole = await prisma.role.create({
        data: {
            name: "ADMIN",
            description: "Administrator with full access to the system",
        },
    });

    const teacherRole = await prisma.role.create({
        data: {
            name: "TEACHER",
            description: "Teacher with access to manage students and projects",
        },
    });

    // --- ROL DE USUARIO LECTOR ---
    const userRole = await prisma.role.create({
        data: {
            name: "user",
            description: "User with read-only access (Students/Guests)",
        },
    });

    console.log("✅ Roles created:", {
        admin: adminRole.name,
        teacher: teacherRole.name,
        user: userRole.name, 
    });

    // ========== PERMISSIONS ==========
    console.log("🔐 Creating permissions...");
    const permissions = await Promise.all([
        prisma.permission.create({
            data: { name: "users:create", description: "Create new users" },
        }),
        prisma.permission.create({
            data: { name: "users:read", description: "View users" },
        }),
        prisma.permission.create({
            data: { name: "users:update", description: "Update users" },
        }),
        prisma.permission.create({
            data: { name: "users:delete", description: "Delete users" },
        }),
        prisma.permission.create({
            data: { name: "projects:create", description: "Create new projects" },
        }),
        prisma.permission.create({
            data: { name: "projects:read", description: "View projects" },
        }),
        prisma.permission.create({
            data: { name: "projects:update", description: "Update projects" },
        }),
        prisma.permission.create({
            data: { name: "projects:delete", description: "Delete projects" },
        }),
        prisma.permission.create({
            data: { name: "roles:manage", description: "Manage roles and permissions" },
        }),
    ]);

    console.log(`✅ Created ${permissions.length} permissions`);

    // ========== ROLE PERMISSIONS ==========
    console.log("🔗 Assigning permissions to roles...");

    // Admin tiene todos los permisos
    const adminPermissions = await Promise.all(
        permissions.map((permission) =>
            prisma.rolePermission.create({
                data: {
                    roleId: adminRole.id,
                    permissionId: permission.id,
                },
            }),
        ),
    );

    // Teacher tiene permisos limitados
    const teacherPermissionNames = [
        "projects:create",
        "projects:read",
        "projects:update",
        "users:read",
    ];
    const teacherPermissions = await Promise.all(
        permissions
            .filter((p) => teacherPermissionNames.includes(p.name))
            .map((permission) =>
                prisma.rolePermission.create({
                    data: {
                        roleId: teacherRole.id,
                        permissionId: permission.id,
                    },
                }),
            ),
    );

    // User (Lector) tiene permisos de solo lectura
    const userPermissionNames = [
        "projects:read",
    ];
    const userPermissions = await Promise.all(
        permissions
            .filter((p) => userPermissionNames.includes(p.name))
            .map((permission) =>
                prisma.rolePermission.create({
                    data: {
                        roleId: userRole.id,
                        permissionId: permission.id,
                    },
                }),
            ),
    );

    console.log(`✅ Assigned ${adminPermissions.length} permissions to ADMIN`);
    console.log(`✅ Assigned ${teacherPermissions.length} permissions to TEACHER`);
    console.log(`✅ Assigned ${userPermissions.length} permissions to USER`);

    // ========== CAREERS ==========
    console.log("🎓 Creating careers...");
    
    const careerNames = [
        "Desarrollo de Software",
        "Redes y Telecomunicaciones",
        "Electricidad",
        "Contabilidad y Asesoría Tributaria",
        "Administración del Talento Humano",
        "Marketing Digital y Negocios",
        "Enfermería",
        "Gastronomía",
        "Turismo",
        "Diseño Gráfico",
        "Administracion"
    ];

    const careers = await Promise.all(
        careerNames.map(name => 
            prisma.career.create({
                data: { name }
            })
        )
    );

    console.log(`✅ Created ${careers.length} careers`);

    // ========== SKILLS ==========
    console.log("💪 Creating skills...");
    const skills = await Promise.all([
        prisma.skills.create({
            data: {
                name: "JavaScript",
                description: "JavaScript programming language",
                details: { category: "Programming Language", level: "Intermediate to Advanced" },
            },
        }),
        prisma.skills.create({
            data: {
                name: "TypeScript",
                description: "TypeScript superset of JavaScript",
                details: { category: "Programming Language", level: "Intermediate to Advanced" },
            },
        }),
        prisma.skills.create({
            data: {
                name: "React",
                description: "React JavaScript library for building user interfaces",
                details: { category: "Frontend Framework", level: "Intermediate" },
            },
        }),
        prisma.skills.create({
            data: {
                name: "Node.js",
                description: "Node.js JavaScript runtime",
                details: { category: "Backend Runtime", level: "Intermediate" },
            },
        }),
        prisma.skills.create({
            data: {
                name: "NestJS",
                description: "NestJS progressive Node.js framework",
                details: { category: "Backend Framework", level: "Advanced" },
            },
        }),
        prisma.skills.create({
            data: {
                name: "Python",
                description: "Python programming language",
                details: { category: "Programming Language", level: "Beginner to Advanced" },
            },
        }),
        prisma.skills.create({
            data: {
                name: "Machine Learning",
                description: "Machine learning and AI",
                details: { category: "Specialization", level: "Advanced" },
            },
        }),
        prisma.skills.create({
            data: {
                name: "Database Design",
                description: "Relational and NoSQL database design",
                details: { category: "Data Management", level: "Intermediate" },
            },
        }),
    ]);

    console.log(`✅ Created ${skills.length} skills`);

    // ========== USERS ==========
    console.log("👤 Creating users...");
    const hashedPassword = bcrypt.hashSync("Luis4036150.", 10);

    // Admin user
    const adminUser = await prisma.user.create({
        data: {
            email: "luis@gmail.com",
            password: hashedPassword,
            name: "Administrator",
            roleId: adminRole.id,
            careerId: careers[0].id, 
        },
    });

    // Teacher users
    const teacher1 = await prisma.user.create({
        data: {
            email: "teacher1@example.com",
            password: hashedPassword,
            name: "Juan Pérez García",
            roleId: teacherRole.id,
            careerId: careers[0].id, 
        },
    });

    const teacher2 = await prisma.user.create({
        data: {
            email: "teacher2@example.com",
            password: hashedPassword,
            name: "María López Hernández",
            roleId: teacherRole.id,
            careerId: careers[1].id, 
        },
    });

    const teacher3 = await prisma.user.create({
        data: {
            email: "teacher3@example.com",
            password: hashedPassword,
            name: "Carlos Ramírez Sánchez",
            roleId: teacherRole.id,
            careerId: careers[2].id, 
        },
    });

    console.log("✅ Created users:");
    console.log(` - Admin: ${adminUser.email}`);
    console.log(` - Teacher: ${teacher1.email}`);

    // ========== PROJECTS ==========
    console.log("📁 Creating projects...");
    const projects = await Promise.all([
        prisma.project.create({
            data: {
                name: "Sistema de Gestión Escolar",
                description: "Desarrollo de un sistema web para gestión administrativa y académica",
                status: "en progreso",
                startDate: new Date("2024-09-01"),
                careerId: careers[0].id,
                objectives: [
                    "Implementar módulo de gestión de estudiantes",
                    "Desarrollar sistema de calificaciones",
                    "Crear panel administrativo",
                ],
                createdBy: teacher1.id,
                deliverables: [
                    "Documentación del sistema",
                    "Código fuente",
                    "Manual de usuario",
                ]
            },
        }),
        prisma.project.create({
            data: {
                name: "Aplicación Móvil de Asistencia",
                description: "App móvil para control de asistencia mediante código QR",
                status: "en progreso",
                startDate: new Date("2024-10-01"),
                careerId: careers[0].id,
                objectives: [
                    "Implementar generación de códigos QR",
                    "Desarrollar lector de QR en dispositivos móviles",
                ],
                createdBy: teacher1.id,
                deliverables: ["App móvil", "Manual de instalación"]
            },
        }),
        prisma.project.create({
            data: {
                name: "Optimización de Redes de Datos",
                description: "Optimización de infraestructura de red mediante simulación",
                status: "completado",
                startDate: new Date("2024-08-01"),
                endDate: new Date("2024-11-01"),
                careerId: careers[1].id,
                objectives: [
                    "Analizar la topología actual",
                    "Identificar cuellos de botella",
                ],
                createdBy: teacher2.id,
                deliverables: ["Informe", "Simulación Packet Tracer"]
            },
        }),
        prisma.project.create({
            data: {
                name: "Sistema IoT de Monitoreo Eléctrico",
                description: "Sistema de monitoreo de consumo con sensores",
                status: "en progreso",
                startDate: new Date("2024-09-15"),
                careerId: careers[2].id,
                objectives: [
                    "Configurar sensores",
                    "Implementar comunicación",
                ],
                createdBy: teacher3.id,
                deliverables: ["Prototipo", "Manual"]
            },
        }),
        prisma.project.create({
            data: {
                name: "Predicción de Demanda con ML",
                description: "Modelo de machine learning para predecir demanda",
                status: "en progreso",
                startDate: new Date("2024-10-15"),
                careerId: careers[0].id,
                objectives: [
                    "Entrenar modelo",
                    "Validar precisión",
                ],
                createdBy: teacher1.id,
                deliverables: ["Modelo", "Informe"]
            },
        }),
    ]);

    console.log(`✅ Created ${projects.length} projects`);

    // ========== USER PROJECTS ==========
    console.log("🔗 Assigning users to projects...");
    await Promise.all([
        prisma.userProject.create({
            data: { userId: teacher1.id, projectId: projects[0].id },
        }),
        prisma.userProject.create({
            data: { userId: teacher1.id, projectId: projects[1].id },
        }),
        prisma.userProject.create({
            data: { userId: teacher1.id, projectId: projects[4].id },
        }),
        prisma.userProject.create({
            data: { userId: teacher2.id, projectId: projects[2].id },
        }),
        prisma.userProject.create({
            data: { userId: teacher3.id, projectId: projects[3].id },
        }),
    ]);

    console.log("✅ User-Project assignments created");

    // ========== PROJECT SKILLS ==========
    console.log("💪 Assigning skills to projects...");
    await Promise.all([
        prisma.projectSkills.create({
            data: { projectId: projects[0].id, skillId: skills[4].id }, // NestJS
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[0].id, skillId: skills[1].id }, // TypeScript
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[0].id, skillId: skills[7].id }, // DB
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[1].id, skillId: skills[2].id }, // React
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[1].id, skillId: skills[0].id }, // JS
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[2].id, skillId: skills[5].id }, // Python
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[3].id, skillId: skills[3].id }, // Node
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[3].id, skillId: skills[0].id }, // JS
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[4].id, skillId: skills[6].id }, // ML
        }),
        prisma.projectSkills.create({
            data: { projectId: projects[4].id, skillId: skills[5].id }, // Python
        }),
    ]);

    console.log("✅ Project-Skills assignments created");
    console.log("\n🎉 Seed completed successfully!");
}

main()
    .catch((e) => {
        console.error("❌ Error during seed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });