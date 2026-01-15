import { api } from '../../utils/api'
import { WISH_STATUS_TEXT } from '../../config'
import type { Wish, WishStatus, FamilyMember } from '../../utils/types'

export { }

// 心愿筛选 Tab
const WISH_TABS = [
  { key: 'mine', label: '我的心愿' },
  { key: 'pending', label: '待我实现' },
  { key: 'all', label: '全部' },
]

Component({
  data: {
    // 家庭相关
    currentFamilyId: '',
    families: [] as any[],
    members: [] as FamilyMember[],

    // 心愿相关
    wishes: [] as Wish[],
    filteredWishes: [] as Wish[],
    wishTabs: WISH_TABS,
    currentTab: 'mine',

    // 当前用户
    user: {} as any,
    userId: '',
    balance: 0,

    // 发布弹窗
    showPublishModal: false,
    publishForm: {
      title: '',
      points: 10,
      description: '',
      implementerId: '',
      implementerName: '',
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
    /** 初始化 */
    async init() {
      const app = getApp()
      // 检查登录状态
      if (!app.isLoggedIn()) {
        this.setData({
          currentFamilyId: '',
          families: [],
        })
        return
      }

      const user = wx.getStorageSync('user') || {}
      this.setData({
        user,
        userId: user.id || '',
      })

      try {
        // 从后端获取家庭列表
        const families = await api.families.list()
        const currentFamilyId = families[0]?.id || ''

        this.setData({
          families,
          currentFamilyId,
        })

        if (currentFamilyId) {
          await this.loadData(currentFamilyId)
        }
      } catch (error) {
        console.error('加载家庭列表失败:', error)
        this.setData({ families: [], currentFamilyId: '' })
      }
    },

    /** 跳转选择/创建家庭 */
    goSelectFamily() {
      wx.navigateTo({ url: '/pages/family/manage/index' })
    },

    /** 加载数据 */
    async loadData(familyId: string) {
      try {
        const [wishes, members] = await Promise.all([
          api.wishes.list(familyId),
          api.families.members(familyId),
        ])

        // 获取余额
        const summary = await api.balances.summary(this.data.userId, familyId)
        const balance = summary.balance

        this.setData({
          wishes,
          members,
          balance,
        })

        this.filterWishes(this.data.currentTab)
      } catch (error) {
        console.error('加载心愿数据失败:', error)
      }
    },

    /** 切换 Tab */
    switchTab(e: any) {
      const key = e.currentTarget.dataset.key
      this.setData({ currentTab: key })
      this.filterWishes(key)
    },

    /** 筛选心愿 */
    filterWishes(tabKey: string) {
      const { wishes, userId } = this.data
      let filtered = [...wishes]

      if (tabKey === 'mine') {
        // 我发布的心愿
        filtered = filtered.filter(w => w.publisherId === userId)
      } else if (tabKey === 'pending') {
        // 需要我实现的心愿（我是实现人，且状态不是已完成）
        filtered = filtered.filter(w => w.implementerId === userId && w.status !== 'fulfilled' && w.status !== 'rejected')
      }

      // 按创建时间倒序
      filtered.sort((a, b) => b.createdAt - a.createdAt)
      this.setData({ filteredWishes: filtered })
    },

    // ========== 发布心愿 ==========
    openPublishModal() {
      if (!this.data.currentFamilyId) {
        wx.showToast({ title: '请先选择家庭', icon: 'none' })
        return
      }
      this.setData({
        showPublishModal: true,
        publishForm: { title: '', points: 10, description: '', implementerId: '', implementerName: '' }
      })
    },

    closePublishModal() {
      this.setData({ showPublishModal: false })
    },

    onFormInput(e: any) {
      const { field } = e.currentTarget.dataset
      const value = e.detail.value
      this.setData({ [`publishForm.${field}`]: field === 'points' ? parseInt(value) || 0 : value })
    },

    /** 选择实现人 */
    selectImplementer(e: any) {
      const idx = e.detail.value
      const member = this.data.members[idx]
      if (member) {
        this.setData({
          'publishForm.implementerId': member.userId,
          'publishForm.implementerName': member.nickName,
        })
      }
    },

    /** 提交发布心愿 */
    async submitPublish() {
      const { title, points, description, implementerId, implementerName } = this.data.publishForm
      if (!title.trim()) {
        wx.showToast({ title: '请输入心愿标题', icon: 'none' })
        return
      }
      if (points < 1) {
        wx.showToast({ title: '积分至少为1', icon: 'none' })
        return
      }
      if (!implementerId) {
        wx.showToast({ title: '请选择实现人', icon: 'none' })
        return
      }

      try {
        await api.wishes.publish(this.data.currentFamilyId, {
          title: title.trim(),
          points,
          description: description.trim() || undefined,
          implementerId,
          implementerName,  // 添加实现人名称
        })

        wx.showToast({ title: '发布成功', icon: 'success' })
        this.closePublishModal()
        await this.loadData(this.data.currentFamilyId)
      } catch (error) {
        console.error('发布心愿失败:', error)
        wx.showToast({ title: '发布失败', icon: 'none' })
      }
    },

    // ========== 心愿操作 ==========
    /** 兑换心愿 */
    async redeemWish(e: any) {
      const id = e.currentTarget.dataset.id
      const wish = this.data.wishes.find(w => w.id === id)

      if (!wish) return

      if (this.data.balance < wish.points) {
        wx.showToast({ title: '积分不足', icon: 'none' })
        return
      }

      wx.showModal({
        title: '确认兑换',
        content: `将消耗 ${wish.points} 积分兑换"${wish.title}"`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.wishes.redeem(id)
              wx.showToast({ title: '已兑换，等待同意', icon: 'success' })
              await this.loadData(this.data.currentFamilyId)
            } catch (error: any) {
              wx.showToast({ title: error?.message || '兑换失败', icon: 'none' })
            }
          }
        }
      })
    },

    /** 同意心愿 */
    async approveWish(e: any) {
      const id = e.currentTarget.dataset.id
      try {
        await api.wishes.approve(id)
        wx.showToast({ title: '已同意', icon: 'success' })
        await this.loadData(this.data.currentFamilyId)
      } catch (error) {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    },

    /** 拒绝心愿 */
    async rejectWish(e: any) {
      const id = e.currentTarget.dataset.id
      wx.showModal({
        title: '拒绝心愿',
        editable: true,
        placeholderText: '可选，填写拒绝原因',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.wishes.reject(id, res.content || '')
              wx.showToast({ title: '已拒绝，积分已退回', icon: 'success' })
              await this.loadData(this.data.currentFamilyId)
            } catch (error) {
              wx.showToast({ title: '操作失败', icon: 'none' })
            }
          }
        }
      })
    },

    /** 标记已实现 */
    async fulfillWish(e: any) {
      const id = e.currentTarget.dataset.id
      try {
        await api.wishes.fulfill(id)
        wx.showToast({ title: '已标记实现', icon: 'success' })
        await this.loadData(this.data.currentFamilyId)
      } catch (error) {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    },

    /** 阻止事件冒泡 */
    stopPropagation() {
      // 空方法，仅用于 catchtap 阻止事件冒泡
    },
  }
})
