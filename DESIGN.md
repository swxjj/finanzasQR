---
name: finanzasQR
description: Sistema universitario de control y toma de asistencia ágil en tiempo real
colors:
  primary: "#10b981"
  primary-hover: "#059669"
  primary-glow: "rgba(16, 185, 129, 0.15)"
  neutral-bg: "#09090b"
  neutral-surface: "#18181b"
  neutral-surface-hover: "#202023"
  neutral-border: "#27272a"
  neutral-text: "#f4f4f5"
  neutral-muted: "#a1a1aa"
  alert-rose: "#f43f5e"
  alert-amber: "#f59e0b"
typography:
  display:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.05em"
  mono:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "0.875rem"
    fontWeight: 700
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  card:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: finanzasQR

## Overview

**Creative North Star: "The Tactical Classroom Instrument"**

finanzasQR está diseñado con una estética minimalista ultra-limpia y de alto contraste táctico. Prioriza la máxima velocidad de lectura y operación en el aula universitaria bajo cualquier condición de iluminación y desde dispositivos móviles en movimiento.

### Key Characteristics:
- **Contraste Puro:** Fondo negro profundo (`#09090b` / Zinc 950) con bordes precisos de 1px (`#27272a` / Zinc 800) y texto claro (`#f4f4f5` / Zinc 100).
- **Acento Esmeralda Táctico:** Verde Esmeralda (`#10b981`) reservado con disciplina exclusiva para estados de éxito, escaneo confirmado y presentismo activo.
- **Tipografía Dual de Precisión:** `DM Sans` para interfaces claras y humanas + `JetBrains Mono` para documentos de identidad, números de libreta, marcas temporales y métricas porcentuales.

## Colors

La paleta es sobria, táctica y de contraste estricto con fondo oscuro profundo.

### Primary
- **Emerald Accent** (`#10b981`): Confirmaciones de asistencia, QR activo, badges de presencia y acciones primarias.

### Neutral
- **Deep Void Background** (`#09090b`): Lienzo base general optimizado para pantallas OLED.
- **Surface Card** (`#18181b`): Contenedores y tarjetas elevated con transparencia y backdrop blur.
- **Border Crisp** (`#27272a`): Delimitadores sutiles de 1px que ordenan la composición sin saturar.
- **Primary Text** (`#f4f4f5`): Tipografía de máxima legibilidad para nombres y títulos.
- **Muted Text** (`#a1a1aa`): Etiquetas secundarias y metadatos complementarios.

### Named Rules
**The Emerald Exclusivity Rule.** El verde esmeralda nunca se utiliza como fondo plano decorativo amplio. Se reserva con exclusividad para botones de confirmación, métricas de éxito y feedback positivo inmediato.

## Typography

**Display Font:** `DM Sans`, sans-serif
**Body Font:** `DM Sans`, sans-serif
**Label/Mono Font:** `JetBrains Mono`, monospace

### Hierarchy
- **Display** (800 weight, 1.5rem, line-height 1.2): Nombres de cabecera e identidad de producto.
- **Headline** (700 weight, 1.125rem, line-height 1.3): Títulos de sección y tarjetas de rol.
- **Body** (500 weight, 0.875rem, line-height 1.5): Textos de interfaz, listas y descripciones breves.
- **Label** (700 weight, 0.6875rem, letter-spacing 0.05em): Encabezados de tabla y badges de estado.
- **Mono Data** (700 weight, font-mono): DNIs, porcentajes de asistencia, libretas y horas.

## Layout

Contenedor centralizado mobile-first con ancho máximo restringido a `max-w-4xl` en escritorio y `max-w-sm` en autenticación/alumno. Soporte completo de safe-areas en iOS/Android.

## Elevation & Depth

No se utilizan sombras difusas pesadas ni gradientes de fantasía. La profundidad se establece mediante capas tonales (`#09090b` -> `#18181b`) y bordes nítidos de 1px (`#27272a`).

## Shapes

- **Contenedores y Tarjetas:** Esquinas suavemente redondeadas con radio de 16px (`rounded-2xl`).
- **Botones e Inputs:** Radio consistente de 12px (`rounded-xl`).
- **Badges y Chips:** Radio compacto de 6-8px o píldora completa (`rounded-full`).

## Components

### Buttons
- **Primary:** Fondo `#10b981`, texto blanco en negrita, radio 12px con feedback activo `scale-[0.98]`.
- **Secondary / Ghost:** Fondo `#27272a` o transparente con borde fino y hover a `#3f3f46`.

### Cards
- **Fondo:** `#18181b` con borde `#27272a`, padding de 16px a 24px y esquinas `rounded-2xl`.

### Inputs
- **Fondo:** `#09090b`, borde `#27272a`, foco con anillo esmeralda `#10b981/80` y tipografía monospace espaciada para campos numéricos.

## Do's and Don'ts

### Do:
- **Do** utilizar `JetBrains Mono` para todo número de DNI, porcentaje y marca de tiempo.
- **Do** mantener el fondo de escaneo y credenciales con alto contraste.
- **Do** proporcionar feedback háptico y sonoro en operaciones críticas de escaneo.

### Don't:
- **Don't** utilizar fondos claros o saturados que agoten la batería del dispositivo móvil en el aula.
- **Don't** aplicar colores de acento no semánticos (evitar mezclar violetas o azules sin propósito).
