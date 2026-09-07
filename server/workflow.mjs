// One server-owned action matrix is used for validation and visible UI actions.
export function availableActions(item, user) {
  if (!item || !user || item.status === '已归档') return [];
  const role = item.currentHandlerRole || 'courier';
  const stage = item.handoffStatus || 'self_handling';
  const assigned = !item.currentHandlerId || item.currentHandlerId === user.id;
  const legalLocked = item.escalated && !item.legalReviewedAt;
  if (user.role === 'courier' && role === 'courier' && assigned) {
    return ['supplement', ...(!legalLocked ? ['negotiate', ...(item.amount <= 1000 ? ['resolve'] : [])] : []), 'handoff_supervisor'];
  }
  if (user.role === 'supervisor' && role === 'supervisor' && assigned) {
    if (stage === 'awaiting_supervisor') return ['accept_supervisor'];
    return ['supplement', ...(!legalLocked ? ['negotiate', 'compensate', 'archive'] : []), 'return_courier', 'request_legal'];
  }
  // A courier may close an ordinary low-risk case independently. Once the
  // courier's pending evidence tasks are complete, the supervisor can still
  // perform the normal review actions directly from the queue; an explicit
  // handoff is only required when the case is actively awaiting receipt.
  if (user.role === 'supervisor' && user.org === item.org && role === 'courier' && stage === 'self_handling' && !legalLocked) {
    return ['supplement', 'negotiate', 'compensate', 'archive', 'request_legal'];
  }
  if (user.role === 'legal' && role === 'legal') {
    if (stage === 'awaiting_legal') return ['accept_legal'];
    if (assigned && (stage === 'legal_handling' || stage === 'self_handling')) return ['supplement', 'return_supervisor', 'legal_approve', 'archive'];
  }
  return [];
}
