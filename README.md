# Inventario de Pozos — ANH

Sistema de gestión del inventario de pozos para la **Agencia Nacional de Hidrocarburos (ANH)**. Permite recibir cargas desde operadoras, validar formato y contenido, asignar el **UWI fiscalizado** según el instructivo ANH (abril 2026) y visualizar la calidad de los datos.

## Funcionalidades

- **Carga de inventario** desde archivo Excel (hoja `FORMATO INVENTARIO POZOS`)
- **Formulario por temas** con listas desplegables oficiales
- **Validación** de campos obligatorios, catálogos, coordenadas y reglas condicionales
- **Generación automática de UWI fiscalizado** (metodología PPDM)
- **Informe de calidad** exportable en CSV para retroalimentar a operadoras
- **Panel de visualización** con estadísticas por estado, departamento y operadora

## Requisitos

- Node.js 20+
- npm

## Instalación

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Datos iniciales

Al primer arranque se cargan automáticamente ~70 registros de ejemplo extraídos del archivo `FORMATO INVENTARIO POZOS ANH.xlsx`, junto con los catálogos de listas desplegables y códigos DANE.

## Estructura UWI fiscalizado

`[Depto 2][Municipio 3][Sigla 4][Número 4][Clúster][Ángulo][Trayectoria][Objetivo]-[Terminación]`

Ver instructivo: *INSTRUCTIVO UWI 16 DE ABRIL DE 2026*.

## Tecnologías

- Next.js 15 (App Router)
- SQLite (better-sqlite3)
- Tailwind CSS
- Recharts
