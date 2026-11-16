import './../src/load-env.js';
import { requireDbServices } from '@mcp-nexus/db-firebird';

const db = requireDbServices();
const result = await db.executeSql.run(`
SELECT classname, COUNT(*) AS cnt, SUM(showinexplorer) AS shown
FROM ac_acct_config
GROUP BY classname
ORDER BY 2 DESC
`);
console.log(JSON.stringify(result.rows, null, 2));
