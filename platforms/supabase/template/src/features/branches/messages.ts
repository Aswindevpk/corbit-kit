// User-facing text for this feature's error codes (shared/standards/error-codes.md).
export const branchMessages: Record<string, string> = {
  BRANCH_CODE_TAKEN: 'Another branch already uses this code.',
  INVALID_BRANCH_CODE: 'Use 2–20 letters, numbers or dashes.',
  INVALID_BRANCH_NAME: 'Enter a name between 2 and 120 characters.',
  BRANCH_NOT_FOUND: 'This branch no longer exists. Refresh the list.',
  BRANCH_ARCHIVED: 'Restore this branch before editing it.',
};
