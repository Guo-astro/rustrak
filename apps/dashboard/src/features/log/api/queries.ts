/**
 * Reads for the log feature: the lines, and how many there were over time.
 */
import type {
  LogResponse,
  LogsListData,
  LogsListResponse,
  LogsVolumeData,
  LogsVolumeResponse,
  Result,
  RustrakError,
} from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

export async function listLogs(
  projectId: number,
  options?: NonNullable<LogsListData['query']>,
): Promise<Result<LogsListResponse, RustrakError>> {
  const client = await createClient();
  return client.logs.list({ path: { project_id: projectId }, query: options });
}

export async function getLog(
  projectId: number,
  logId: string,
): Promise<Result<LogResponse, RustrakError>> {
  const client = await createClient();
  return client.logs.get({ path: { project_id: projectId, log_id: logId } });
}

export async function getLogVolume(
  projectId: number,
  options?: NonNullable<LogsVolumeData['query']>,
): Promise<Result<LogsVolumeResponse, RustrakError>> {
  const client = await createClient();
  return client.logs.volume({
    path: { project_id: projectId },
    query: options,
  });
}
