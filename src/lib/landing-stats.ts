import { getDb } from "./db";
import { getActiveValidationRuleCount } from "./validation";

export interface LandingStats {
  wells: number;
  operators: number;
  validationRules: number;
}

export function getLandingStats(): LandingStats {
  const database = getDb();

  const wells = (database.prepare("SELECT COUNT(*) AS c FROM wells").get() as { c: number }).c;
  const operators = (
    database
      .prepare(
        `SELECT COUNT(DISTINCT operadora) AS c FROM wells WHERE operadora IS NOT NULL AND TRIM(operadora) != ''`,
      )
      .get() as { c: number }
  ).c;

  return {
    wells,
    operators,
    validationRules: getActiveValidationRuleCount(),
  };
}
