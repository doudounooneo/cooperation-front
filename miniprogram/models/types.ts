export interface User { id: string; nickName: string; avatarUrl: string }
export interface Family { id: string; name: string }
export type TaskStatus = 'unassigned'|'claimed'|'completed'|'verified'
export interface Task { id: string; title: string; points: number; status: TaskStatus; publisherId: string; assigneeId?: string; familyId: string; createdAt: number }
export type WishStatus = 'open'|'pending_approval'|'approved'|'rejected'
export interface Wish { id: string; title: string; points: number; implementerName: string; requesterId: string; familyId: string; status: WishStatus; createdAt: number }
export type MessageType = 'wish_request'|'task_verification'|'system'
export interface Message { id: string; type: MessageType; unread: boolean; toUserId?: string; toUserName?: string; content: string; refId?: string; familyId?: string; createdAt: number }
