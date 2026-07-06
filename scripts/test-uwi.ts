import { generateUwiFiscalizado, INSTRUCTIVO_EXAMPLES, buildUwiComponents } from "../src/lib/uwi";
import type { WellRecord } from "../src/lib/types";

let passed = 0;
let failed = 0;

for (const example of INSTRUCTIVO_EXAMPLES) {
  const record = example.record as WellRecord;
  const result = generateUwiFiscalizado(record);
  const components = buildUwiComponents(record);
  const ok = result === example.expected;
  if (ok) {
    passed++;
    console.log(`✓ ${example.name}`);
  } else {
    failed++;
    console.log(`✗ ${example.name}`);
    console.log(`  esperado: ${example.expected}`);
    console.log(`  obtenido: ${result}`);
    if (components) console.log(`  partes:`, components);
  }
}

console.log(`\n${passed} pasaron, ${failed} fallaron de ${INSTRUCTIVO_EXAMPLES.length}`);
