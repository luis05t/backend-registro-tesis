# Sistema de Autenticación - Documentación

## 📋 Resumen de Cambios

Se ha implementado un sistema de autenticación basado en roles con dos roles predefinidos: **ADMIN** y **TEACHER**.

## 🔐 Roles Disponibles

Los roles están definidos en el enum `ValidRoles`:

```typescript
export enum ValidRoles {
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
}
```

## 🎯 Uso del Decorador @Auth

### Importación

```typescript
import { Auth } from './auth/decorators';
import { ValidRoles } from './auth/enums';
import { GetUser } from './auth/decorators';
```

### Ejemplos de Uso

#### 1. Solo ADMIN
```typescript
@Get('admin-only')
@Auth(ValidRoles.ADMIN)
getAdminData(@GetUser() user: any) {
  return { message: 'Solo accesible por ADMIN' };
}
```

#### 2. Solo TEACHER
```typescript
@Get('teacher-only')
@Auth(ValidRoles.TEACHER)
getTeacherData(@GetUser() user: any) {
  return { message: 'Solo accesible por TEACHER' };
}
```

#### 3. ADMIN o TEACHER
```typescript
@Get('admin-or-teacher')
@Auth(ValidRoles.ADMIN, ValidRoles.TEACHER)
getData(@GetUser() user: any) {
  return { message: 'Accesible por ADMIN o TEACHER' };
}
```

#### 4. Cualquier usuario autenticado (sin rol específico)
```typescript
@Post('authenticated')
@Auth()
createData(@GetUser() user: any) {
  return { message: 'Requiere autenticación pero no rol específico' };
}
```

## 🌱 Seed de Base de Datos

### Ejecutar el Seed

```bash
# Opción 1: Usar Prisma
npx prisma db seed

# Opción 2: Ejecutar directamente
npx ts-node prisma/seed.ts
```

### Datos Creados por el Seed

#### Roles
- **ADMIN**: Administrador con acceso completo
- **TEACHER**: Profesor con permisos limitados

#### Permisos
- `users:create`, `users:read`, `users:update`, `users:delete`
- `projects:create`, `projects:read`, `projects:update`, `projects:delete`
- `roles:manage`

**Asignación:**
- ADMIN: Todos los permisos
- TEACHER: `projects:create`, `projects:read`, `projects:update`, `users:read`

#### Usuarios de Prueba

| Email | Contraseña | Rol | Carrera |
|-------|-----------|-----|---------|
| admin@example.com | password123 | ADMIN | Sistemas Computacionales |
| teacher1@example.com | password123 | TEACHER | Sistemas Computacionales |
| teacher2@example.com | password123 | TEACHER | Ingeniería Industrial |
| teacher3@example.com | password123 | TEACHER | Ingeniería Electrónica |

#### Carreras
- Ingeniería en Sistemas Computacionales
- Ingeniería Industrial
- Ingeniería Electrónica
- Ingeniería Mecánica
- Ingeniería Civil

#### Skills
- JavaScript, TypeScript, React, Node.js, NestJS
- Python, Machine Learning, Database Design

#### Proyectos
5 proyectos de ejemplo asignados a diferentes profesores y carreras.

## 🔄 Flujo de Autenticación

1. **Login**: El usuario hace login con email y password
   ```bash
   POST /auth/login
   {
     "email": "admin@example.com",
     "password": "password123"
   }
   ```

2. **Respuesta**: Recibe un `accessToken` y `refreshToken`
   ```json
   {
     "userId": "uuid",
     "UserRole": { "name": "ADMIN", ... },
     "accessToken": "...",
     "refreshToken": "..."
   }
   ```

3. **Uso del Token**: Incluir en headers
   ```
   Authorization: Bearer <accessToken>
   ```

4. **Validación**: El guard `UserRoleGuard` verifica:
   - ✅ Usuario autenticado
   - ✅ Token válido
   - ✅ Usuario tiene rol asignado
   - ✅ Rol está en la lista de roles permitidos del endpoint

## 🛡️ Guards y Decoradores

### Arquitectura

```
@Auth(ValidRoles.ADMIN)
    ↓
Aplica dos decoradores:
    ↓
1. @RoleProtected(ValidRoles.ADMIN)
   - Guarda los roles en metadata
    ↓
2. @UseGuards(AuthGuard(), UserRoleGuard)
   - AuthGuard: Valida el JWT
   - UserRoleGuard: Valida los roles
```

### UserRoleGuard

El guard verifica:
1. Usuario está autenticado
2. Usuario tiene rol asignado (`user.role`)
3. El nombre del rol está en los roles permitidos
4. Lanza error si no cumple los requisitos

## 📝 Notas Importantes

- Los permisos están en la base de datos pero **no se validan automáticamente** por ahora
- Solo se validan los roles predefinidos (ADMIN, TEACHER)
- El JWT Strategy ahora incluye el rol y carrera del usuario
- El guard soporta tanto HTTP como GraphQL

## 🚀 Próximos Pasos (Futuro)

1. Implementar validación de permisos granulares
2. Agregar más roles según necesidades
3. Implementar sistema de auditoría
4. Agregar límites de tasa (rate limiting)
