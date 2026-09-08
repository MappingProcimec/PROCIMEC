# Regla de Control de Versiones y Ejecución

1. **Push Automático a GitHub:**
   Siempre que se realicen cambios en el código o archivos del repositorio:
   - Ejecutar `git add .` (verificando que `bot-whatsapp/` permanezca excluido en `.gitignore`)
   - Realizar un commit claro y descriptivo con `git commit`
   - **Realizar `git push origin main` inmediatamente sin esperar a que el usuario lo pida** (salvo que el usuario indique explícitamente no subir cambios).

2. **Entorno de Ejecución:**
   - **NO levantar servidores de desarrollo locales** (`npm run dev`, etc.) a menos que el usuario lo solicite explícitamente.
   - **NO abrir navegadores** (Chrome/Edge/subagentes de browser) a menos que el usuario lo pida expresamente.
