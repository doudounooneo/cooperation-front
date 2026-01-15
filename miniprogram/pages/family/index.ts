import { api } from '../../utils/api'
import { TASK_STATUS_TEXT } from '../../config'
import type { Task, TaskStatus, FamilyMember } from '../../utils/types'

export { }

// 任务筛选 Tab 配置
const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'unassigned', label: '待领取' },
  { key: 'claimed', label: '进行中' },
  { key: 'completed', label: '待验证' },
  { key: 'verified', label: '已完成' },
]

Component({
  data: {
    // 家庭相关
    currentFamilyId: '',
    currentFamilyName: '',
    families: [] as any[],
    hasFamilies: false,
    members: [] as FamilyMember[],

    // 任务相关
    tasks: [] as Task[],
    filteredTasks: [] as Task[],
    statusTabs: STATUS_TABS,
    currentTab: 'all',

    // 统计
    stats: {
      totalTasks: 0,
      pendingTasks: 0,
      myTasks: 0,
      totalPoints: 0,
    },

    // 当前用户
    userId: '',
    isParent: false,

    // 弹窗
    showPublishModal: false,
    publishForm: {
      title: '',
      points: 5,
      description: '',
      deadline: '',
    },
  },

  lifetimes: {
    attached() {
      this.init()
    }
  },

  pageLifetimes: {
    show() {
      this.init()
    }
  },

  methods: {
    /** 初始化页面 */
    async init() {
      const app = getApp()
      // 检查登录状态
      if (!app.isLoggedIn()) {
        this.setData({
          hasFamilies: false,
          families: [],
          currentFamilyId: '',
          currentFamilyName: '',
        })
        return
      }

      const user = wx.getStorageSync('user') || {}
      this.setData({ userId: user.id || '' })

      try {
        // 从后端获取家庭列表
        const families = await api.families.list()
        const currentFamilyId = families[0]?.id || ''
        const currentFamilyName = families[0]?.name || ''

        this.setData({
          families,
          currentFamilyId,
          currentFamilyName,
          hasFamilies: families.length > 0,
        })

        if (currentFamilyId) {
          await this.loadData(currentFamilyId)
        }
      } catch (error) {
        console.error('加载家庭列表失败:', error)
        this.setData({
          hasFamilies: false,
          families: [],
        })
      }
    },

    /** 加载家庭数据 */
    async loadData(familyId: string) {
      try {
        // 并行加载任务和成员
        const [tasks, members] = await Promise.all([
          api.tasks.list(familyId),
          api.families.members(familyId),
        ])

        // 计算用户角色
        const userId = this.data.userId
        const member = members.find(m => m.userId === userId)
        const isParent = member?.role === 'parent'

        // 计算统计
        const stats = {
          totalTasks: tasks.length,
          pendingTasks: tasks.filter(t => t.status === 'unassigned').length,
          myTasks: tasks.filter(t => t.assigneeId === userId).length,
          totalPoints: tasks.filter(t => t.assigneeId === userId && t.status === 'verified')
            .reduce((sum, t) => sum + t.points, 0),
        }

        this.setData({
          tasks,
          members,
          isParent,
          stats,
        })

        // 应用筛选
        this.filterTasks(this.data.currentTab)
      } catch (error) {
        console.error('加载数据失败:', error)
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    },

    /** 根据 ID 获取家庭名称 */
    getFamilyNameById(families: any[], id: string): string {
      const found = families.find(f => f.id === id)
      return found?.name || ''
    },

    /** 切换家庭 */
    async switchFamily(e: any) {
      const idx = e.detail.value
      const family = this.data.families[idx]
      if (!family) return

      wx.setStorageSync('currentFamilyId', family.id)
      this.setData({
        currentFamilyId: family.id,
        currentFamilyName: family.name,
        currentTab: 'all',
      })

      await this.loadData(family.id)
    },

    /** 切换筛选 Tab */
    switchTab(e: any) {
      const key = e.currentTarget.dataset.key
      this.setData({ currentTab: key })
      this.filterTasks(key)
    },

    /** 筛选任务列表 */
    filterTasks(tabKey: string) {
      const { tasks, userId } = this.data
      let filtered = [...tasks]

      if (tabKey !== 'all') {
        filtered = filtered.filter(t => t.status === tabKey)
      }

      // 排序：按创建时间倒序
      filtered.sort((a, b) => b.createdAt - a.createdAt)

      this.setData({ filteredTasks: filtered })
    },

    /** 检查登录状态 */
    ensureLogin(cb: Function) {
      const user = wx.getStorageSync('user')
      if (user?.nickName && user?.avatarUrl) {
        cb()
        return
      }
      wx.showModal({
        title: '需要登录',
        content: '请先完善个人资料以继续',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/index' })
          }
        }
      })
    },

    /** 跳转创建家庭 */
    goCreateFamily() {
      this.ensureLogin(() => {
        wx.navigateTo({ url: '/pages/family/manage/index?mode=create' })
      })
    },

    /** 跳转绑定家庭 */
    goBindFamily() {
      this.ensureLogin(() => {
        wx.navigateTo({ url: '/pages/family/manage/index?mode=bind' })
      })
    },

    // ========== 发布任务 ==========
    /** 打开发布弹窗 */
    openPublishModal() {
      if (!this.data.currentFamilyId) {
        wx.showToast({ title: '请先选择家庭', icon: 'none' })
        return
      }
      this.setData({
        showPublishModal: true,
        publishForm: { title: '', points: 5, description: '', deadline: '' }
      })
    },

    /** 关闭发布弹窗 */
    closePublishModal() {
      this.setData({ showPublishModal: false })
    },

    /** 表单输入处理 */
    onFormInput(e: any) {
      const { field } = e.currentTarget.dataset
      const value = e.detail.value
      this.setData({ [`publishForm.${field}`]: field === 'points' ? parseInt(value) || 0 : value })
    },

    /** 提交发布任务 */
    async submitPublish() {
      const { title, points, description, deadline } = this.data.publishForm
      if (!title.trim()) {
        wx.showToast({ title: '请输入任务标题', icon: 'none' })
        return
      }
      if (points < 1) {
        wx.showToast({ title: '积分至少为1', icon: 'none' })
        return
      }

      try {
        await api.tasks.publish(this.data.currentFamilyId, {
          title: title.trim(),
          points,
          description: description.trim() || undefined,
          deadline: deadline ? new Date(deadline).getTime() : undefined,
        })

        wx.showToast({ title: '发布成功', icon: 'success' })
        this.closePublishModal()
        await this.loadData(this.data.currentFamilyId)
      } catch (error) {
        console.error('发布任务失败:', error)
        wx.showToast({ title: '发布失败', icon: 'none' })
      }
    },

    // ========== 任务操作 ==========
    /** 领取任务 */
    async claimTask(e: any) {
      const id = e.currentTarget.dataset.id
      try {
        await api.tasks.claim(id)
        wx.showToast({ title: '领取成功', icon: 'success' })
        await this.loadData(this.data.currentFamilyId)
      } catch (error) {
        console.error('领取任务失败:', error)
        wx.showToast({ title: '领取失败', icon: 'none' })
      }
    },

    /** 完成任务 */
    async completeTask(e: any) {
      const id = e.currentTarget.dataset.id
      try {
        await api.tasks.complete(id)
        wx.showToast({ title: '已提交，等待验证', icon: 'success' })
        await this.loadData(this.data.currentFamilyId)
      } catch (error) {
        console.error('完成任务失败:', error)
        wx.showToast({ title: '提交失败', icon: 'none' })
      }
    },

    /** 验证任务 */
    async verifyTask(e: any) {
      const id = e.currentTarget.dataset.id
      wx.showActionSheet({
        itemList: ['通过验证', '退回重做'],
        success: async (res) => {
          const approve = res.tapIndex === 0
          try {
            await api.tasks.verify(id, approve)
            wx.showToast({ title: approve ? '已验证，积分已发放' : '已退回', icon: 'success' })
            await this.loadData(this.data.currentFamilyId)
          } catch (error) {
            console.error('验证任务失败:', error)
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      })
    },

    /** 删除任务（仅发布者可操作） */
    async deleteTask(e: any) {
      const id = e.currentTarget.dataset.id
      wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复，确定删除？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.tasks.delete(id)
              wx.showToast({ title: '已删除', icon: 'success' })
              await this.loadData(this.data.currentFamilyId)
            } catch (error) {
              console.error('删除任务失败:', error)
              wx.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    },

    /** 获取任务状态文本 */
    getStatusText(status: TaskStatus): string {
      return TASK_STATUS_TEXT[status] || status
    },

    /** 阻止事件冒泡 */
    stopPropagation() {
      // 空方法，仅用于 catchtap 阻止事件冒泡
    },
  }
})
