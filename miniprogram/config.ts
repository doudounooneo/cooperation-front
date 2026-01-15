/**
 * 应用配置文件
 */

// 是否使用模拟数据（开发时设为 true，对接后端时设为 false）
export const USE_MOCK_DATA = false

// 后端 API 基础地址（对接后端时替换为实际地址）
export const API_BASE_URL = 'http://localhost:9010'

// 默认头像
export const DEFAULT_AVATAR_URL = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

// 每个用户最多加入的家庭数
export const MAX_FAMILIES = 5

// 任务状态显示文本
export const TASK_STATUS_TEXT: Record<string, string> = {
    unassigned: '待领取',
    claimed: '进行中',
    completed: '待验证',
    verified: '已完成',
    expired: '已过期',
}

// 心愿状态显示文本
export const WISH_STATUS_TEXT: Record<string, string> = {
    open: '可兑换',
    pending_approval: '待同意',
    approved: '已同意',
    rejected: '已拒绝',
    fulfilled: '已实现',
}

// 消息类型显示文本
export const MESSAGE_TYPE_TEXT: Record<string, string> = {
    wish_request: '💫 心愿请求',
    task_verification: '✅ 任务验证',
    system: '📢 系统通知',
    points_change: '💰 积分变动',
}
