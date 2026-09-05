import { apiClient, getApiUrl } from '../config';
import { TARGET_COMPARATORS } from './targetCatalog';

const createInvalidResponseError = () => new Error('The Targets API returned an invalid response.');

const comparators = new Set(TARGET_COMPARATORS.map((entry) => entry.key));

/*
 * A Qualifier is one criterion: a diet slice, a comparator, and a share
 * threshold in the 0–1 range. A player fits a Target only by meeting every one
 * of them, so a Target with no Qualifier cannot exist.
 */
const decodeQualifier = (item) => {
  if (!item || typeof item !== 'object') throw createInvalidResponseError();
  const { base, slice_key: sliceKey, comparator, threshold } = item;
  if (
    typeof base !== 'string' ||
    typeof sliceKey !== 'string' ||
    !comparators.has(comparator) ||
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 1
  ) {
    throw createInvalidResponseError();
  }
  return { base, sliceKey, comparator, threshold };
};

/*
 * The title is derived by the backend and never stored or edited here, so it
 * arrives with the record rather than being rebuilt from it. See
 * crf04/statsplus docs/adr/0001-targets-store-player-criteria-not-team-readings.md.
 */
const decodeTarget = (item) => {
  if (!item || typeof item !== 'object') throw createInvalidResponseError();
  const { id, opponent, title, note, created_at: createdAt, qualifiers } = item;
  const hasId = typeof id === 'string' || typeof id === 'number';
  if (
    !hasId ||
    typeof opponent !== 'string' ||
    typeof title !== 'string' ||
    typeof createdAt !== 'string' ||
    !Array.isArray(qualifiers) ||
    qualifiers.length === 0 ||
    (note !== null && note !== undefined && typeof note !== 'string')
  ) {
    throw createInvalidResponseError();
  }
  return {
    id,
    opponent,
    title,
    note: note || '',
    createdAt,
    qualifiers: qualifiers.map(decodeQualifier),
  };
};

export const decodeTargets = (payload = {}) => {
  if (!payload || !Array.isArray(payload.targets)) throw createInvalidResponseError();
  return payload.targets.map(decodeTarget);
};

const encodeQualifier = (qualifier) => ({
  base: qualifier.base,
  slice_key: qualifier.sliceKey,
  comparator: qualifier.comparator,
  threshold: qualifier.threshold,
});

const targetsUrl = (path = '') => `${getApiUrl('TARGETS')}${path}`;

export const fetchTargets = async ({ signal } = {}) => {
  const response = await apiClient.get(targetsUrl(), { signal });
  return decodeTargets(response.data);
};

/*
 * Create answers with the stored Target and the rest report success or throw.
 * Either way the list caller reloads rather than patching one in place, so the
 * order and the derived titles shown are always the backend's.
 *
 * What create returns is the record as stored, carrying the title the backend
 * derived. A surface that confirms a save by name has to say that title rather
 * than a locally guessed one. See crf04/statsplus
 * docs/adr/0001-targets-store-player-criteria-not-team-readings.md.
 */
export const createTarget = async ({ opponent, qualifiers, note }) => {
  const response = await apiClient.post(targetsUrl(), {
    opponent,
    qualifiers: qualifiers.map(encodeQualifier),
    note,
  });
  return decodeTarget(response.data?.target);
};

/*
 * Only the Qualifiers and the note are editable. The opponent is what the
 * Target is about, so changing it would make a different Target.
 */
export const updateTarget = async ({ id, qualifiers, note }) => {
  await apiClient.patch(targetsUrl(`/${encodeURIComponent(id)}`), {
    qualifiers: qualifiers.map(encodeQualifier),
    note,
  });
};

export const deleteTarget = async ({ id }) => {
  await apiClient.delete(targetsUrl(`/${encodeURIComponent(id)}`));
};
