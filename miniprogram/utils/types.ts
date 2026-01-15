/**
 * 家庭任务积分小程序 - 类型定义
 */

// ========== 用户角色 ==========
export type FamilyRole = 'parent' | 'child'

// ========== 任务状态 ==========
export type TaskStatus = 'unassigned' | 'claimed' | 'completed' | 'verified' | 'expired'

// ========== 心愿状态 ==========
export type WishStatus = 'open' | 'pending_approval' | 'approved' | 'rejected' | 'fulfilled'

// ========== 消息类型 ==========
export type MessageType = 'wish_request' | 'task_verification' | 'system' | 'points_change'

// ========== 用户信息 ==========
export interface User {
    id: string
    openId?: string
    nickName: string
    avatarUrl: string
}

// ========== 家庭 ==========
export interface Family {
    id: string
    name: string
    inviteCode: string
    creatorId: string
    createdAt: number
    memberCount?: number
}

// ========== 家庭成员 ==========
export interface FamilyMember {
    userId: string
    familyId: string
    role: FamilyRole
    nickName: string
    avatarUrl: string
    points: number
    joinedAt: number
}

// ========== 任务 ==========
export interface Task {
    id: string
    title: string
    description?: string
    points: number
    status: TaskStatus
    publisherId: string
    publisherName?: string
    assigneeId?: string
    assigneeName?: string
    familyId: string
    deadline?: number
    createdAt: number
    claimedAt?: number
    completedAt?: number
    verifiedAt?: number
}

// ========== 创建任务参数 ==========
export interface CreateTaskData {
    title: string
    description?: string
    points: number
    deadline?: number
}

// ========== 任务筛选参数 ==========
export interface TaskFilter {
    status?: TaskStatus | TaskStatus[]
    publisherId?: string
    assigneeId?: string
}

// ========== 心愿 ==========
export interface Wish {
    id: string
    title: string
    description?: string
    points: number
    status: WishStatus
    publisherId?: string
    publisherName?: string
    requesterId: string
    requesterName?: string
    implementerId: string
    implementerName?: string
    familyId: string
    createdAt: number
    redeemedAt?: number
    approvedAt?: number
    fulfilledAt?: number
    rejectReason?: string
}

// ========== 创建心愿参数 ==========
export interface CreateWishData {
    title: string
    description?: string
    points: number
    implementerId: string
    implementerName?: string
}

// ========== 心愿筛选参数 ==========
export interface WishFilter {
    status?: WishStatus | WishStatus[]
    requesterId?: string
    implementerId?: string
}

// ========== 站内信 ==========
export interface Message {
    id: string
    type: MessageType
    title?: string
    content: string
    unread: boolean
    toUserId: string
    fromUserId?: string
    refId?: string
    refType?: 'task' | 'wish'
    familyId?: string
    createdAt: number
}

// ========== 消息列表参数 ==========
export interface MessageListParams {
    unreadOnly?: boolean
    type?: MessageType
    limit?: number
    offset?: number
}

// ========== API 响应格式 ==========
export interface ApiResponse<T = any> {
    code: number
    message: string
    data: T
}

// ========== 登录响应 ==========
export interface LoginResponse {
    token: string
    user: User
    isNewUser: boolean
}

// ========== 积分变动记录 ==========
export interface PointsLog {
    id: string
    userId: string
    familyId: string
    delta: number
    balance: number
    reason: string
    refType?: 'task' | 'wish' | 'manual'
    refId?: string
    createdAt: number
}
