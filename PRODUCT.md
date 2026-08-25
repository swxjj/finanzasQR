# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Profesores / Docentes de Cátedra (Usuario Principal):** Docentes universitarios a cargo del dictado de la materia. Utilizan sus teléfonos móviles o computadoras en el aula para tomar asistencia continua escaneando los códigos QR de los estudiantes o ingresando DNI manualmente. Consultan la matriz consolidada de presentismo en tiempo real.
- **Alumnos Universitarios:** Estudiantes inscriptos en la materia. Ingresan desde sus dispositivos para generar y descargar su código QR personalizado con su número de DNI para presentarlo en cada clase. No consultan métricas en la app; cualquier duda sobre su porcentaje de asistencia la consultan directamente con el cuerpo docente.

## Product Purpose

QR Asist es una aplicación web ágil y mobile-friendly diseñada para optimizar y modernizar la toma de asistencia en el ámbito universitario. Elimina las planillas de papel y el tipeo manual posterior, consolidando las asistencias tomadas por cualquier docente de la cátedra directamente en una planilla centralizada de Google Sheets en tiempo real.

## Positioning

A diferencia de los sistemas de gestión académica pesados (ej: SIU Guaraní) o planillas manuales desconectadas, QR Asist ofrece escaneo instantáneo con cámara continua, feedback sonoro (Web Audio API), funcionamiento offline de contingencia y sincronización bidireccional automática con Google Sheets sin requerir servidores propios ni bases de datos complejas.

## Operating Context

- **Entorno de uso:** Aulas universitarias con alta concurrencia al inicio de la clase.
- **Dispositivos:** Teléfonos inteligentes (iOS / Android) para escaneo dinámico y laptops para revisión del reporte general.
- **Conectividad:** Diseñado para redes con posible intermitencia (soporta cola offline y sincronización apenas se restablece la conexión).
- **Fase actual:** Prueba piloto en una materia de grado universitario.

## Capabilities and Constraints

- **Acceso Docente Protegido:** Pantalla de login (usuario y contraseña) para evitar que los estudiantes accedan al escáner o a los reportes.
- **Padrón de Alumnos:** Lista de estudiantes cargada en Google Sheets (DNI, Libreta Universitaria, Nombre y Apellido) o importada vía CSV.
- **Escáner Continuo:** Detección rápida de códigos QR con cooldown de 2.5s y validación contra padrón.
- **Detección de Duplicados:** Bloqueo de doble registro en la misma fecha para evitar fraudes.
- **Reporte Matricial:** Cálculo automático del porcentaje de presentismo = `(clases asistidas / total de clases registradas) * 100`.
- **Exportación:** Descarga de matriz en formato CSV y sincronización en vivo con Google Sheets (`Padron`, `Asistencias`, `Matriz_Presentismo`).
- **Vista Alumno Pública:** Generador y descargador de QR (PNG 800x800) a partir del DNI ingresado.

## Brand Commitments

- **Nombre:** QR Asist.
- **Tono y Voz:** Claro, profesional, ágil, sin fricción y enfocado en la usabilidad en el aula.
- **Identidad Visual:** Tema oscuro sobrio y moderno (Slate 950/900 con acentos en Índigo y Esmeralda para estados positivos).

## Product Principles

1. **Cero Fricción en el Aula:** El escáner debe ser instantáneo, emitir confirmación sonora clara y no requerir confirmaciones manuales adicionales por cada alumno.
2. **Sincronización Transparente:** Los datos pertenecen a la cátedra; cualquier profesor que abra la app debe ver el estado real consolidado en Google Sheets.
3. **Resiliencia Operativa:** Una caída momentánea de WiFi o datos móviles no debe interrumpir la toma de asistencia.
4. **Simplicidad de Roles:** Separación estricta entre la herramienta del docente y el generador público de credenciales del alumno.
