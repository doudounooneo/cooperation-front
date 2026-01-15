import type {
  User, Family, FamilyMember, FamilyRole,
  Task, CreateTaskData, TaskFilter,
  Wish, CreateWishData, WishFilter,
  Message, MessageListParams,
  LoginResponse, PointsLog
} from './types'
import { USE_MOCK_DATA, API_BASE_URL } from '../config'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// ========== 通用请求方法 ==========
export function request<T = any>(method: Method, path: string, data?: any, headers?: Record<string, string>): Promise<T> {
  const token = wx.getStorageSync('token') || ''

  // 调试日志
  console.log(`[API] ${method} ${path}`, { hasToken: !!token })

  return new Promise((resolve, reject) => {
    const wxMethod = (method === 'PATCH' ? 'POST' : method) as WechatMiniprogram.RequestOption['method']
    wx.request({
      url: API_BASE_URL + path,
      method: wxMethod,
      data,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        ...(method === 'PATCH' ? { 'X-HTTP-Method-Override': 'PATCH' } : {}),
        ...(headers || {})
      },
      success: (res) => {
        const ok = (res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300
        if (!ok) {
          // 401 未授权时提示登录
          if (res.statusCode === 401) {
            console.warn('[API] 401 未授权')
            // 不自动清除 token，让用户手动处理
          }
          reject(res)
          return
        }
        // 兼容 {code,message,data} 与直接数据
        const body: any = res.data
        resolve(body?.data ?? body)
      },
      fail: reject,
    })
  })
}

// ========== API 接口定义 ==========
export const api = {
  // ========== 认证模块 ==========
  auth: {
    /**
     * 微信登录
     * @param jsCode wx.login 获取的 code
     */
    wxLogin(jsCode: string): Promise<LoginResponse> {
      if (USE_MOCK_DATA) {
        // 模拟登录
        const user = wx.getStorageSync('user') || {
          id: `U${Date.now().toString(36)}`,
          nickName: '',
          avatarUrl: ''
        }
        return Promise.resolve({ token: 'mock_token', user, isNewUser: !user.nickName })
      }
      return request('POST', '/auth/wx-login', { code: jsCode })
    },

    /** 获取当前用户信息 */
    me(): Promise<User> {
      if (USE_MOCK_DATA) {
        return Promise.resolve(wx.getStorageSync('user') || {})
      }
      return request('GET', '/auth/me')
    },

    /** 更新用户资料 */
    updateProfile(data: Partial<User>): Promise<User> {
      if (USE_MOCK_DATA) {
        const user = { ...wx.getStorageSync('user'), ...data }
        wx.setStorageSync('user', user)
        return Promise.resolve(user)
      }
      return request('PUT', '/auth/profile', data)
    },
  },

  // ========== 家庭模块 ==========
  families: {
    /** 获取我的家庭列表 */
    list(): Promise<Family[]> {
      if (USE_MOCK_DATA) {
        return Promise.resolve(wx.getStorageSync('families') || [])
      }
      return request('GET', '/families')
    },

    /** 获取家庭详情 */
    get(familyId: string): Promise<Family> {
      if (USE_MOCK_DATA) {
        const families = wx.getStorageSync('families') || []
        return Promise.resolve(families.find((f: Family) => f.id === familyId))
      }
      return request('GET', `/families/${familyId}`)
    },

    /** 创建家庭 */
    create(name: string): Promise<Family> {
      if (USE_MOCK_DATA) {
        const user = wx.getStorageSync('user') || {}
        const code = `F${Date.now().toString(36)}`
        const family: Family = {
          id: code,
          name,
          inviteCode: code,
          creatorId: user.id || 'self',
          createdAt: Date.now(),
          memberCount: 1
        }
        const families = [family, ...(wx.getStorageSync('families') || [])]
        wx.setStorageSync('families', families)
        wx.setStorageSync('currentFamilyId', code)
        // 初始化成员
        const members = wx.getStorageSync('familyMembers') || {}
        members[code] = [{
          userId: user.id || 'self',
          familyId: code,
          role: 'parent' as FamilyRole,
          nickName: user.nickName || '我',
          avatarUrl: user.avatarUrl || '',
          points: 0,
          joinedAt: Date.now()
        }]
        wx.setStorageSync('familyMembers', members)
        return Promise.resolve(family)
      }
      return request('POST', '/families', { name })
    },

    /** 绑定家庭（通过邀请码加入） */
    bind(inviteCode: string): Promise<Family> {
      if (USE_MOCK_DATA) {
        const user = wx.getStorageSync('user') || {}
        // 模拟验证邀请码 - 实际应从后端验证
        const families = wx.getStorageSync('families') || []
        if (families.find((f: Family) => f.id === inviteCode || f.inviteCode === inviteCode)) {
          return Promise.reject({ message: '已加入该家庭' })
        }
        const family: Family = {
          id: inviteCode,
          name: `家庭${inviteCode.slice(-4)}`,
          inviteCode: inviteCode,
          creatorId: 'unknown',
          createdAt: Date.now(),
          memberCount: 2
        }
        const newFamilies = [family, ...families]
        wx.setStorageSync('families', newFamilies)
        wx.setStorageSync('currentFamilyId', inviteCode)
        // 添加成员
        const members = wx.getStorageSync('familyMembers') || {}
        members[inviteCode] = [...(members[inviteCode] || []), {
          userId: user.id || 'self',
          familyId: inviteCode,
          role: 'child' as FamilyRole,
          nickName: user.nickName || '我',
          avatarUrl: user.avatarUrl || '',
          points: 0,
          joinedAt: Date.now()
        }]
        wx.setStorageSync('familyMembers', members)
        return Promise.resolve(family)
      }
      return request('POST', '/families/bind', { inviteCode })
    },

    /** 退出家庭 */
    leave(familyId: string): Promise<void> {
      if (USE_MOCK_DATA) {
        const families = (wx.getStorageSync('families') || []).filter((f: Family) => f.id !== familyId)
        wx.setStorageSync('families', families)
        if (wx.getStorageSync('currentFamilyId') === familyId) {
          wx.setStorageSync('currentFamilyId', families[0]?.id || '')
        }
        return Promise.resolve()
      }
      return request('DELETE', `/families/${familyId}/leave`)
    },

    /** 获取家庭成员列表 */
    members(familyId: string): Promise<FamilyMember[]> {
      if (USE_MOCK_DATA) {
        const members = wx.getStorageSync('familyMembers') || {}
        return Promise.resolve(members[familyId] || [])
      }
      return request('GET', `/families/${familyId}/members`)
    },

    /** 更新成员角色（仅家长可操作） */
    updateMemberRole(familyId: string, userId: string, role: FamilyRole): Promise<void> {
      if (USE_MOCK_DATA) {
        const members = wx.getStorageSync('familyMembers') || {}
        const list = (members[familyId] || []).map((m: FamilyMember) =>
          m.userId === userId ? { ...m, role } : m
        )
        members[familyId] = list
        wx.setStorageSync('familyMembers', members)
        return Promise.resolve()
      }
      return request('PATCH', `/families/${familyId}/members/${userId}/role`, { role })
    },

    /** 移除成员（仅家长可操作） */
    removeMember(familyId: string, userId: string): Promise<void> {
      if (USE_MOCK_DATA) {
        const members = wx.getStorageSync('familyMembers') || {}
        members[familyId] = (members[familyId] || []).filter((m: FamilyMember) => m.userId !== userId)
        wx.setStorageSync('familyMembers', members)
        return Promise.resolve()
      }
      return request('DELETE', `/families/${familyId}/members/${userId}`)
    },

    /** 设置当前家庭 */
    setCurrent(familyId: string): Promise<void> {
      wx.setStorageSync('currentFamilyId', familyId)
      if (USE_MOCK_DATA) {
        return Promise.resolve()
      }
      return request('PATCH', '/families/current', { familyId })
    },
  },

  // ========== 任务模块 ==========
  tasks: {
    /** 获取任务列表 */
    list(familyId: string, filter?: TaskFilter): Promise<Task[]> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('tasks') || {}
        let list = all[familyId] || []
        if (filter?.status) {
          const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
          list = list.filter((t: Task) => statuses.includes(t.status))
        }
        if (filter?.publisherId) {
          list = list.filter((t: Task) => t.publisherId === filter.publisherId)
        }
        if (filter?.assigneeId) {
          list = list.filter((t: Task) => t.assigneeId === filter.assigneeId)
        }
        return Promise.resolve(list)
      }
      return request('GET', `/families/${familyId}/tasks`, filter)
    },

    /** 获取任务详情 */
    get(taskId: string): Promise<Task> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('tasks') || {}
        for (const fid in all) {
          const task = all[fid].find((t: Task) => t.id === taskId)
          if (task) return Promise.resolve(task)
        }
        return Promise.reject({ message: '任务不存在' })
      }
      return request('GET', `/tasks/${taskId}`)
    },

    /** 发布任务 */
    publish(familyId: string, data: CreateTaskData): Promise<Task> {
      if (USE_MOCK_DATA) {
        const user = wx.getStorageSync('user') || {}
        const task: Task = {
          id: `T${Date.now()}`,
          title: data.title,
          description: data.description,
          points: data.points,
          status: 'unassigned',
          publisherId: user.id || 'self',
          publisherName: user.nickName,
          familyId,
          deadline: data.deadline,
          createdAt: Date.now(),
        }
        const all = wx.getStorageSync('tasks') || {}
        all[familyId] = [task, ...(all[familyId] || [])]
        wx.setStorageSync('tasks', all)
        return Promise.resolve(task)
      }
      return request('POST', `/families/${familyId}/tasks`, data)
    },

    /** 领取任务 */
    claim(taskId: string): Promise<Task> {
      if (USE_MOCK_DATA) {
        const user = wx.getStorageSync('user') || {}
        const all = wx.getStorageSync('tasks') || {}
        let updated: Task | null = null
        for (const fid in all) {
          all[fid] = all[fid].map((t: Task) => {
            if (t.id === taskId) {
              updated = {
                ...t,
                status: 'claimed',
                assigneeId: user.id || 'self',
                assigneeName: user.nickName,
                claimedAt: Date.now()
              }
              return updated
            }
            return t
          })
        }
        wx.setStorageSync('tasks', all)
        return Promise.resolve(updated!)
      }
      return request('PATCH', `/tasks/${taskId}/claim`)
    },

    /** 提交完成 */
    complete(taskId: string): Promise<Task> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('tasks') || {}
        let updated: Task | null = null
        let publisherId = ''
        let familyId = ''
        for (const fid in all) {
          all[fid] = all[fid].map((t: Task) => {
            if (t.id === taskId) {
              updated = { ...t, status: 'completed', completedAt: Date.now() }
              publisherId = t.publisherId
              familyId = t.familyId
              return updated
            }
            return t
          })
        }
        wx.setStorageSync('tasks', all)
        // 发送验证通知
        if (updated) {
          const msg: Message = {
            id: `M${Date.now()}`,
            type: 'task_verification',
            content: `任务"${updated.title}"已完成，请验证`,
            unread: true,
            toUserId: publisherId,
            refId: taskId,
            refType: 'task',
            familyId,
            createdAt: Date.now(),
          }
          const messages = [msg, ...(wx.getStorageSync('messages') || [])]
          wx.setStorageSync('messages', messages)
        }
        return Promise.resolve(updated!)
      }
      return request('PATCH', `/tasks/${taskId}/complete`)
    },

    /** 验证任务（通过/拒绝） */
    verify(taskId: string, approve = true): Promise<Task> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('tasks') || {}
        let updated: Task | null = null
        for (const fid in all) {
          all[fid] = all[fid].map((t: Task) => {
            if (t.id === taskId) {
              if (approve) {
                updated = { ...t, status: 'verified', verifiedAt: Date.now() }
                // 加积分
                this._addPoints(t.familyId, t.assigneeId!, t.points)
              } else {
                updated = { ...t, status: 'claimed' }  // 退回进行中状态
              }
              return updated
            }
            return t
          })
        }
        wx.setStorageSync('tasks', all)
        return Promise.resolve(updated!)
      }
      return request('PATCH', `/tasks/${taskId}/verify`, { approve })
    },

    /** 删除任务 */
    delete(taskId: string): Promise<void> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('tasks') || {}
        for (const fid in all) {
          all[fid] = all[fid].filter((t: Task) => t.id !== taskId)
        }
        wx.setStorageSync('tasks', all)
        return Promise.resolve()
      }
      return request('DELETE', `/tasks/${taskId}`)
    },

    /** 内部方法：增加积分 */
    _addPoints(familyId: string, userId: string, delta: number) {
      const balances = wx.getStorageSync('balances') || {}
      const fam = balances[familyId] || {}
      fam[userId] = (fam[userId] || 0) + delta
      balances[familyId] = fam
      wx.setStorageSync('balances', balances)
      // 更新成员积分
      const members = wx.getStorageSync('familyMembers') || {}
      if (members[familyId]) {
        members[familyId] = members[familyId].map((m: FamilyMember) =>
          m.userId === userId ? { ...m, points: (m.points || 0) + delta } : m
        )
        wx.setStorageSync('familyMembers', members)
      }
    },
  },

  // ========== 心愿模块 ==========
  wishes: {
    /** 获取心愿列表 */
    list(familyId: string, filter?: WishFilter): Promise<Wish[]> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('wishes') || {}
        let list = all[familyId] || []
        if (filter?.status) {
          const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
          list = list.filter((w: Wish) => statuses.includes(w.status))
        }
        if (filter?.requesterId) {
          list = list.filter((w: Wish) => w.requesterId === filter.requesterId)
        }
        if (filter?.implementerId) {
          list = list.filter((w: Wish) => w.implementerId === filter.implementerId)
        }
        return Promise.resolve(list)
      }
      return request('GET', `/families/${familyId}/wishes`, filter)
    },

    /** 发布心愿 */
    publish(familyId: string, data: CreateWishData): Promise<Wish> {
      if (USE_MOCK_DATA) {
        const user = wx.getStorageSync('user') || {}
        const members = wx.getStorageSync('familyMembers') || {}
        const implementer = (members[familyId] || []).find((m: FamilyMember) => m.userId === data.implementerId)
        const wish: Wish = {
          id: `W${Date.now()}`,
          title: data.title,
          description: data.description,
          points: data.points,
          status: 'open',
          requesterId: user.id || 'self',
          requesterName: user.nickName,
          implementerId: data.implementerId,
          implementerName: implementer?.nickName || '未知',
          familyId,
          createdAt: Date.now(),
        }
        const all = wx.getStorageSync('wishes') || {}
        all[familyId] = [wish, ...(all[familyId] || [])]
        wx.setStorageSync('wishes', all)
        return Promise.resolve(wish)
      }
      return request('POST', `/families/${familyId}/wishes`, data)
    },

    /** 兑换心愿（扣积分） */
    redeem(wishId: string): Promise<Wish> {
      if (USE_MOCK_DATA) {
        const user = wx.getStorageSync('user') || {}
        const all = wx.getStorageSync('wishes') || {}
        let updated: Wish | null = null

        for (const fid in all) {
          const wish = all[fid].find((w: Wish) => w.id === wishId)
          if (wish) {
            // 检查积分
            const balances = wx.getStorageSync('balances') || {}
            const uid = user.id || 'self'
            const bal = (balances[fid]?.[uid]) || 0
            if (bal < wish.points) {
              return Promise.reject({ message: '积分不足' })
            }
            // 扣积分
            balances[fid] = balances[fid] || {}
            balances[fid][uid] = bal - wish.points
            wx.setStorageSync('balances', balances)
            // 更新心愿状态
            all[fid] = all[fid].map((w: Wish) => {
              if (w.id === wishId) {
                updated = { ...w, status: 'pending_approval', redeemedAt: Date.now() }
                return updated
              }
              return w
            })
            wx.setStorageSync('wishes', all)
            // 发送消息给实现人
            const msg: Message = {
              id: `M${Date.now()}`,
              type: 'wish_request',
              content: `${user.nickName || '成员'}兑换了心愿"${wish.title}"，请确认`,
              unread: true,
              toUserId: wish.implementerId,
              refId: wishId,
              refType: 'wish',
              familyId: fid,
              createdAt: Date.now(),
            }
            const messages = [msg, ...(wx.getStorageSync('messages') || [])]
            wx.setStorageSync('messages', messages)
            break
          }
        }
        return Promise.resolve(updated!)
      }
      return request('POST', `/wishes/${wishId}/redeem`)
    },

    /** 同意心愿 */
    approve(wishId: string): Promise<Wish> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('wishes') || {}
        let updated: Wish | null = null
        for (const fid in all) {
          all[fid] = all[fid].map((w: Wish) => {
            if (w.id === wishId) {
              updated = { ...w, status: 'approved', approvedAt: Date.now() }
              return updated
            }
            return w
          })
        }
        wx.setStorageSync('wishes', all)
        return Promise.resolve(updated!)
      }
      return request('POST', `/wishes/${wishId}/approve`)
    },

    /** 拒绝心愿（退回积分） */
    reject(wishId: string, reason?: string): Promise<Wish> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('wishes') || {}
        let updated: Wish | null = null
        for (const fid in all) {
          const wish = all[fid].find((w: Wish) => w.id === wishId)
          if (wish) {
            // 退回积分
            const balances = wx.getStorageSync('balances') || {}
            balances[fid] = balances[fid] || {}
            balances[fid][wish.requesterId] = (balances[fid][wish.requesterId] || 0) + wish.points
            wx.setStorageSync('balances', balances)
            // 更新状态
            all[fid] = all[fid].map((w: Wish) => {
              if (w.id === wishId) {
                updated = { ...w, status: 'rejected', rejectReason: reason }
                return updated
              }
              return w
            })
            wx.setStorageSync('wishes', all)
            break
          }
        }
        return Promise.resolve(updated!)
      }
      return request('POST', `/wishes/${wishId}/reject`, { reason })
    },

    /** 标记心愿已实现 */
    fulfill(wishId: string): Promise<Wish> {
      if (USE_MOCK_DATA) {
        const all = wx.getStorageSync('wishes') || {}
        let updated: Wish | null = null
        for (const fid in all) {
          all[fid] = all[fid].map((w: Wish) => {
            if (w.id === wishId) {
              updated = { ...w, status: 'fulfilled', fulfilledAt: Date.now() }
              return updated
            }
            return w
          })
        }
        wx.setStorageSync('wishes', all)
        return Promise.resolve(updated!)
      }
      return request('POST', `/wishes/${wishId}/fulfill`)
    },
  },

  // ========== 消息模块 ==========
  messages: {
    /** 获取消息列表 */
    list(params?: MessageListParams): Promise<Message[]> {
      if (USE_MOCK_DATA) {
        let list = wx.getStorageSync('messages') || []
        if (params?.unreadOnly) {
          list = list.filter((m: Message) => m.unread)
        }
        if (params?.type) {
          list = list.filter((m: Message) => m.type === params.type)
        }
        return Promise.resolve(list)
      }
      return request('GET', '/messages', params)
    },

    /** 标记已读 */
    markRead(id: string): Promise<void> {
      if (USE_MOCK_DATA) {
        const messages = (wx.getStorageSync('messages') || []).map((m: Message) =>
          m.id === id ? { ...m, unread: false } : m
        )
        wx.setStorageSync('messages', messages)
        return Promise.resolve()
      }
      return request('PATCH', `/messages/${id}/read`)
    },

    /** 全部标记已读 */
    markAllRead(): Promise<void> {
      if (USE_MOCK_DATA) {
        const messages = (wx.getStorageSync('messages') || []).map((m: Message) => ({ ...m, unread: false }))
        wx.setStorageSync('messages', messages)
        return Promise.resolve()
      }
      return request('PATCH', '/messages/read-all')
    },
  },

  // ========== 积分模块 ==========
  balances: {
    /** 获取家庭成员积分 */
    list(familyId: string): Promise<FamilyMember[]> {
      if (USE_MOCK_DATA) {
        const members = wx.getStorageSync('familyMembers') || {}
        const balances = wx.getStorageSync('balances') || {}
        const fam = balances[familyId] || {}
        return Promise.resolve((members[familyId] || []).map((m: FamilyMember) => ({
          ...m,
          points: fam[m.userId] || m.points || 0
        })))
      }
      return request('GET', `/families/${familyId}/balances`)
    },

    /** 手动调整积分（仅家长可操作） */
    adjust(familyId: string, userId: string, delta: number, reason?: string): Promise<void> {
      if (USE_MOCK_DATA) {
        const balances = wx.getStorageSync('balances') || {}
        balances[familyId] = balances[familyId] || {}
        balances[familyId][userId] = (balances[familyId][userId] || 0) + delta
        wx.setStorageSync('balances', balances)
        return Promise.resolve()
      }
      return request('PATCH', `/families/${familyId}/balances/adjust`, { userId, delta, reason })
    },

    /** 获取用户积分汇总 */
    summary(userId: string, familyId: string): Promise<{ totalVerified: number, balance: number }> {
      if (USE_MOCK_DATA) {
        return Promise.resolve({ totalVerified: 0, balance: 0 })
      }
      return request('GET', `/users/${userId}/points/summary?familyId=${familyId}`)
    },
  },
}
