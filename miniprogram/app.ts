import { api } from './utils/api'
import { DEFAULT_AVATAR_URL } from './config'

// 定义全局数据类型
interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo
  }
  /** 检查是否已登录 */
  isLoggedIn(): boolean
  /** 手动登录 */
  login(): Promise<boolean>
  /** 检查登录状态，未登录则提示 */
  checkLogin(): boolean
}

App<IAppOption>({
  globalData: {},

  onLaunch() {
    // 打印启动日志
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 不再自动登录，等待用户手动触发
    console.log('小程序启动，等待用户登录')
  },

  /** 检查是否已登录 */
  isLoggedIn(): boolean {
    const token = wx.getStorageSync('token')
    const user = wx.getStorageSync('user')
    return !!(token && user?.id)
  },

  /** 检查登录状态，未登录则提示跳转 */
  checkLogin(): boolean {
    if (this.isLoggedIn()) {
      return true
    }
    wx.showModal({
      title: '提示',
      content: '请先登录后再操作',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          // 跳转到"我的"页面进行登录
          wx.switchTab({ url: '/pages/profile/index' })
        }
      }
    })
    return false
  },

  /** 手动登录 */
  async login(): Promise<boolean> {
    try {
      // 调用 wx.login 获取 code
      const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      console.log('wx.login code:', loginRes.code)

      // 调用后端登录接口
      const result = await api.auth.wxLogin(loginRes.code)

      // 保存 token 和用户信息
      if (result.token) {
        wx.setStorageSync('token', result.token)
      }
      if (result.user) {
        // 设置默认头像
        if (!result.user.avatarUrl) {
          result.user.avatarUrl = DEFAULT_AVATAR_URL
        }
        wx.setStorageSync('user', result.user)
      }

      console.log('登录成功:', result.isNewUser ? '新用户' : '老用户')
      return true

    } catch (error) {
      console.error('登录失败:', error)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      return false
    }
  },
})