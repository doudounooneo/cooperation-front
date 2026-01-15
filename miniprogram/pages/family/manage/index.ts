import { api } from '../../../utils/api'
import { MAX_FAMILIES } from '../../../config'
import type { Family, FamilyMember, FamilyRole } from '../../../utils/types'

export { }

Component({
  data: {
    mode: 'list',  // 'list' | 'create' | 'bind'
    name: '',
    codeInput: '',
    families: [] as Family[],
    members: [] as FamilyMember[],
    currentFamilyId: '',
    maxFamilies: MAX_FAMILIES,
    userId: '',
    isParent: false,
  },

  lifetimes: {
    attached() {
      const query = this.getPageQuery()
      const mode = query.mode || 'list'
      this.setData({ mode })
      this.init()
    }
  },

  pageLifetimes: {
    show() {
      this.init()
    }
  },

  methods: {
    getPageQuery() {
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1] as any
      return cur?.options || {}
    },

    async init() {
      const user = wx.getStorageSync('user') || {}
      this.setData({ userId: user.id || '' })

      try {
        // 从后端获取家庭列表
        const families = await api.families.list()
        const currentFamilyId = families[0]?.id || ''

        this.setData({
          families,
          currentFamilyId,
        })

        // 如果是列表模式，加载当前家庭成员
        if (this.data.mode === 'list' && currentFamilyId) {
          await this.loadMembers(currentFamilyId)
        }
      } catch (error) {
        console.error('加载家庭列表失败:', error)
        this.setData({ families: [] })
      }
    },

    async loadMembers(familyId: string) {
      try {
        const members = await api.families.members(familyId)
        const member = members.find(m => m.userId === this.data.userId)
        this.setData({
          members,
          isParent: member?.role === 'parent',
        })
      } catch (error) {
        console.error('加载成员失败:', error)
      }
    },

    // ========== 表单输入 ==========
    onNameInput(e: any) {
      this.setData({ name: e.detail.value })
    },

    onCodeInput(e: any) {
      this.setData({ codeInput: e.detail.value })
    },

    // ========== 创建家庭 ==========
    async createFamily() {
      // 检查登录状态
      const app = getApp()
      if (!app.checkLogin()) {
        return
      }

      const { families, maxFamilies, name } = this.data as any
      if (families.length >= maxFamilies) {
        wx.showToast({ title: `最多加入${maxFamilies}个家庭`, icon: 'none' })
        return
      }

      const trimmedName = name?.trim()
      if (!trimmedName) {
        wx.showToast({ title: '请输入家庭名称', icon: 'none' })
        return
      }

      try {
        await api.families.create(trimmedName)
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 500)
      } catch (error) {
        wx.showToast({ title: '创建失败', icon: 'none' })
      }
    },

    // ========== 绑定家庭 ==========
    async bindFamily() {
      // 检查登录状态
      const app = getApp()
      if (!app.checkLogin()) {
        return
      }

      const { families, maxFamilies, codeInput } = this.data as any
      if (families.length >= maxFamilies) {
        wx.showToast({ title: `最多加入${maxFamilies}个家庭`, icon: 'none' })
        return
      }

      const code = codeInput?.trim()
      if (!code) {
        wx.showToast({ title: '请输入家庭编号', icon: 'none' })
        return
      }

      if (families.find((f: Family) => f.id === code || f.inviteCode === code)) {
        wx.showToast({ title: '已加入该家庭', icon: 'none' })
        return
      }

      try {
        await api.families.bind(code)
        wx.showToast({ title: '加入成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 500)
      } catch (error: any) {
        wx.showToast({ title: error?.message || '绑定失败', icon: 'none' })
      }
    },

    // ========== 家庭操作 ==========
    copyCode(e: any) {
      const code = e.currentTarget.dataset.code
      wx.setClipboardData({
        data: code,
        success: () => wx.showToast({ title: '已复制邀请码', icon: 'success' })
      })
    },

    async switchCurrent(e: any) {
      const id = e.currentTarget.dataset.id
      await api.families.setCurrent(id)
      this.setData({ currentFamilyId: id })
      wx.showToast({ title: '已切换', icon: 'success' })
      await this.loadMembers(id)
    },

    // ========== 分享 ==========
    shareFamily(e: any) {
      const code = e.currentTarget.dataset.code
      const name = e.currentTarget.dataset.name
      // 微信小程序分享需要在页面配置中启用
      wx.showModal({
        title: '分享家庭',
        content: `邀请码：${code}\n\n将此邀请码分享给家人，让他们加入${name}`,
        showCancel: true,
        cancelText: '取消',
        confirmText: '复制邀请码',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({ data: code })
          }
        }
      })
    },

    // ========== 成员管理 ==========
    async setMemberRole(e: any) {
      const { userId, role } = e.currentTarget.dataset
      const newRole: FamilyRole = role === 'parent' ? 'child' : 'parent'

      try {
        await api.families.updateMemberRole(this.data.currentFamilyId, userId, newRole)
        wx.showToast({ title: '已更新', icon: 'success' })
        await this.loadMembers(this.data.currentFamilyId)
      } catch (error) {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    },

    async removeMember(e: any) {
      const { userId, name } = e.currentTarget.dataset

      wx.showModal({
        title: '移除成员',
        content: `确定将 ${name} 移出家庭？`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.families.removeMember(this.data.currentFamilyId, userId)
              wx.showToast({ title: '已移除', icon: 'success' })
              await this.loadMembers(this.data.currentFamilyId)
            } catch (error) {
              wx.showToast({ title: '操作失败', icon: 'none' })
            }
          }
        }
      })
    },

    async leaveFamily(e: any) {
      const id = e.currentTarget.dataset.id
      const name = e.currentTarget.dataset.name

      wx.showModal({
        title: '退出家庭',
        content: `确定退出"${name}"？退出后将无法查看该家庭的任务和心愿。`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.families.leave(id)
              wx.showToast({ title: '已退出', icon: 'success' })
              await this.init()
            } catch (error) {
              wx.showToast({ title: '操作失败', icon: 'none' })
            }
          }
        }
      })
    },

    // ========== 模式切换 ==========
    goCreate() {
      this.setData({ mode: 'create', name: '' })
    },

    goBind() {
      this.setData({ mode: 'bind', codeInput: '' })
    },

    goBack() {
      if (this.data.mode !== 'list') {
        this.setData({ mode: 'list' })
      } else {
        wx.navigateBack()
      }
    },
  }
})
