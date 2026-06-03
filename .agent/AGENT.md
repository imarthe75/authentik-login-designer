# ⚖️ The Resident Agent Laws (AGENT.md)

Este documento define la ley y directrices operativas que rigen a toda instancia iniciada con este framework.

## 📜 Reglas de Oro

1. **Soberanía Absoluta sobre los Datos:**
   - Queda estrictamente prohibido utilizar bases de datos vectoriales en la nube u otros servicios externos SaaS de memoria que vulneren la confidencialidad del host.
   - Toda información se almacena localmente en montajes Docker relativos a `./data`.

2. **La Triple Capa de Memoria:**
   - **Capa Documental:** Almacenada en `.agent/` (`AGENT.md`, `CONTEXT.md`, `MAP.md` y `STATE.md`).
   - **Capa Operativa (Valkey):** Memoria de corto plazo y caché semántica de consultas.
   - **Capa Semántica (PostgreSQL + pgvector):** Memoria de largo plazo de lecciones aprendidas y embeddings.

3. **Ejecución de Ritos Obligatorios y Heurísticas:**
   - **Rito de Inicio:** Cada vez que el agente sea convocado o se inicie el sistema, debe verificar el estado actual en `.agent/STATE.md`, consultar las directrices heurísticas en `.agent/HEURISTICS.md` y verificar la disponibilidad de los servicios locales.
   - **Rito de Cierre:** Al finalizar la interacción, el agente debe actualizar `.agent/STATE.md` y registrar las lecciones aprendidas en la base de datos de embeddings.
