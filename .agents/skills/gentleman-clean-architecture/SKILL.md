---
name: gentleman-clean-architecture
description: Guía de Arquitectura Limpia, Puertos y Adaptadores (Hexagonal Architecture) inspirada en la metodología de Gentleman Programming para Next.js y TypeScript.
---

# Habilidad: Arquitectura Limpia Hexagonal (Gentleman Programming)

Esta habilidad establece las reglas arquitectónicas para desacoplar el dominio del negocio de frameworks externos, APIs de terceros (IA, pasarelas, almacenamiento) y detalles de la interfaz de usuario.

## Principios Fundamentales

1. **Regla de Dependencia:**
   - Las dependencias apuntan exclusivamente hacia adentro:
     `UI / Infraestructura -> Aplicación (Casos de Uso) -> Dominio (Entidades / Puertos)`.
   - El Dominio no debe importar nada de `next/*`, `react`, `@google/*`, `@supabase/*`. Solo TypeScript puro y utilidades de validación básica.

2. **Puertos y Adaptadores:**
   - **Puerto (Port):** Es una interfaz TypeScript en `domain/ports/` que declara QUÉ necesita el sistema (ej. `AiPort`, `EmailPort`, `StoragePort`).
   - **Adaptador (Adapter):** Es una clase en `infrastructure/adapters/` que implementa el puerto y resuelve el CÓMO técnico con una librería específica (ej. `GeminiAdapter`, `SendgridAdapter`, `SupabaseStorageAdapter`).

3. **Casos de Uso (Application Layer):**
   - Cada acción de negocio tiene su propio caso de uso con un método único `execute(...)`.
   - Inyecta los puertos a través del constructor (Inversión de Control / Dependency Injection).
   - Facilita pruebas unitarias inmediatas sustituyendo el adaptador real por un `MockAdapter`.

## Estructura de Directorios Estándar

```
src/core/[modulo]/
├── domain/
│   ├── ports/
│   │   └── [nombre].port.ts
│   └── models/
│       └── [nombre].models.ts
├── infrastructure/
│   ├── adapters/
│   │   ├── [nombre].adapter.ts
│   │   └── mock.adapter.ts
│   └── schemas/
│       └── [nombre].schemas.ts
└── application/
    └── use-cases/
        └── [nombre].use-case.ts
```
