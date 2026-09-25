export function reviewStatusAfterInteractiveRepair(currentStatus?: string | null) {
  return currentStatus === 'revision_requested' ? 'revision_requested' : 'reviewed';
}
