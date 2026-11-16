import {
  TransactionIsolation,
  type Attachment,
} from 'node-firebird-driver-native';

/**
 * Session binds so NUMERIC/DECIMAL aggregates are not returned as INT128/DECFLOAT
 * (D13). Does not rely on DataTypeCompatibility in firebird.conf.
 */
export const LEGACY_TYPE_BIND_STATEMENTS = [
  'SET BIND OF INT128 TO LEGACY',
  'SET BIND OF DECFLOAT TO LEGACY',
] as const;

export async function applyLegacyTypeBinds(
  attachment: Attachment
): Promise<void> {
  const transaction = await attachment.startTransaction({
    isolation: TransactionIsolation.READ_COMMITTED,
    readCommittedMode: 'RECORD_VERSION',
    waitMode: 'NO_WAIT',
    accessMode: 'READ_WRITE',
  });

  try {
    for (const sql of LEGACY_TYPE_BIND_STATEMENTS) {
      await attachment.execute(transaction, sql);
    }
    await transaction.commit();
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      /* ignore */
    }
    throw error;
  }
}
