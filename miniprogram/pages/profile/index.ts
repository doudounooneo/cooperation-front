import { api } from '../../utils/api'
import { DEFAULT_AVATAR_URL } from '../../config'
import type { FamilyMember } from '../../utils/types'

export { }

Component({
  data: {
    user: { avatarUrl: DEFAULT_AVATAR_URL, nickName: '', id: '' },
    hasUserInfo: false,
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    currentFamilyId: '',
    currentFamilyName: '',
    myPoints: 0,
    balance: 0,
    unreadCount: 0,
    families: [] as any[],
    members: [] as FamilyMember[],
    isParent: false,
    // 模态框相关
    showModal: false,
    tempAvatarUrl: '',
    tempNickName: '',
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
    async init() {
      // 检查是否已登录（有 token）
      const token = wx.getStorageSync('token')
      const user = wx.getStorageSync('user') || { avatarUrl: DEFAULT_AVATAR_URL, nickName: '', id: '' }
      const hasUserInfo = !!(token && user?.id)

      this.setData({
        user,
        hasUserInfo,
        tempAvatarUrl: user.avatarUrl,
        tempNickName: user.nickName,
      })

      if (!hasUserInfo) {
        return
      }

      try {
        // 从后端获取家庭列表
        const families = await api.families.list()
        const currentFamilyId = families[0]?.id || ''
        const currentFamily = families[0]

        this.setData({
          currentFamilyId,
          currentFamilyName: currentFamily?.name || '',
          families,
        })

        if (currentFamilyId) {
          await this.loadFamilyData(currentFamilyId)
        }
      } catch (error) {
        console.error('加载家庭数据失败:', error)
      }
    },

    /** 执行登录 */
    async doLogin() {
      wx.showLoading({ title: '登录中...' })
      try {
        const app = getApp()
        const success = await app.login()
        wx.hideLoading()

        if (success) {
          wx.showToast({ title: '登录成功', icon: 'success' })
          // 重新加载数据
          await this.init()
        }
      } catch (error) {
        wx.hideLoading()
        console.error('登录失败:', error)
        wx.showToast({ title: '登录失败', icon: 'none' })
      }
    },

    async loadFamilyData(familyId: string) {
      try {
        const members = await api.families.members(familyId)
        const summary = await api.balances.summary(this.data.user.id, familyId)
        const balance = summary.balance
        const myPoints = summary.totalVerified

        const userId = this.data.user.id || 'self'
        const member = members.find(m => m.userId === userId)

        this.setData({
          members,
          balance,
          myPoints,
          isParent: member?.role === 'parent',
        })
      } catch (error) {
        console.error('加载家庭数据失败:', error)
      }
    },

    // ========== 模态框控制 ==========
    showAuthModal() {
      this.setData({
        showModal: true,
        tempAvatarUrl: this.data.user.avatarUrl || DEFAULT_AVATAR_URL,
        tempNickName: this.data.user.nickName || '',
      })
    },

    hideAuthModal() {
      this.setData({ showModal: false })
    },

    // ========== 头像选择 ==========
    onChooseAvatar(e: any) {
      const { avatarUrl } = e.detail
      if (this.data.showModal) {
        // 模态框内选择头像
        this.setData({ tempAvatarUrl: avatarUrl })
      } else {
        // 直接在头部选择头像（已登录状态）
        const user = {
          ...this.data.user,
          avatarUrl,
          id: this.data.user.id || `U${Date.now().toString(36)}`
        }
        wx.setStorageSync('user', user)
        this.setData({ user })
        this.updateProfile({ avatarUrl })
      }
    },

    // ========== 昵称输入 ==========
    onNicknameInput(e: any) {
      this.setData({ tempNickName: e.detail.value })
    },

    onNicknameBlur(e: any) {
      // 微信昵称组件会在 blur 时返回真实昵称
      if (e.detail.value) {
        this.setData({ tempNickName: e.detail.value })
      }
    },

    // ========== 确认保存 ==========
    async confirmAuth() {
      const { tempAvatarUrl, tempNickName } = this.data

      if (!tempNickName || !tempNickName.trim()) {
        wx.showToast({ title: '请输入昵称', icon: 'none' })
        return
      }

      const user = {
        ...this.data.user,
        avatarUrl: tempAvatarUrl || DEFAULT_AVATAR_URL,
        nickName: tempNickName.trim(),
        id: this.data.user.id || `U${Date.now().toString(36)}`
      }

      wx.setStorageSync('user', user)

      this.setData({
        user,
        hasUserInfo: true,
        showModal: false,
      })

      // 更新服务器
      await this.updateProfile({
        nickName: user.nickName,
        avatarUrl: user.avatarUrl
      })

      wx.showToast({ title: '保存成功', icon: 'success' })

      // 重新加载数据
      this.init()
    },

    // ========== 更新服务端资料 ==========
    async updateProfile(data: { nickName?: string; avatarUrl?: string }) {
      try {
        // 检查是否已登录（有有效 token）
        const token = wx.getStorageSync('token')
        if (!token) {
          console.log('未登录，跳过服务器更新')
          return
        }
        await api.auth.updateProfile(data)
      } catch (error) {
        console.error('更新资料失败:', error)
      }
    },

    // ========== 导航 ==========
    openMessages() {
      wx.navigateTo({ url: '/pages/messages/index' })
    },

    openFamilyManage() {
      wx.navigateTo({ url: '/pages/family/manage/index' })
    },

    // ========== 退出登录 ==========
    logout() {
      wx.showModal({
        title: '确认退出登录？',
        content: '退出后本地数据将保留',
        success: (res) => {
          if (res.confirm) {
            wx.removeStorageSync('user')
            wx.removeStorageSync('token')
            this.setData({
              user: { avatarUrl: DEFAULT_AVATAR_URL, nickName: '', id: '' },
              hasUserInfo: false,
            })
            wx.showToast({ title: '已退出', icon: 'success' })
          }
        }
      })
    }
  }
})
