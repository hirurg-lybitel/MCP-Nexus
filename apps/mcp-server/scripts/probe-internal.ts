import './../src/load-env.js';
import { requireDbServices } from '@mcp-nexus/db-firebird';

const db = requireDbServices();
const cols = await db.executeSql.run(`
SELECT TRIM(rf.rdb$relation_name) AS rn, TRIM(rf.rdb$field_name) AS fn
FROM rdb$relation_fields rf
WHERE UPPER(TRIM(rf.rdb$field_name)) = 'ISINTERNAL'
ORDER BY 1
`);
console.log(JSON.stringify(cols.rows, null, 2));
