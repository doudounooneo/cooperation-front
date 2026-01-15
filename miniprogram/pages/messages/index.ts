import { api } from '../../utils/api'
import { MESSAGE_TYPE_TEXT } from '../../config'
import type { Message } from '../../utils/types'

export { }

Component({
  data: {
    messages: [] as Message[],
    unreadCount: 0,
  },

  lifetimes: {
    attached() {
      this.loadMessages()
    }
  },

  pageLifetimes: {
    show() {
      this.loadMessages()
    }
  },

  methods: {
    async loadMessages() {
      try {
        const messages = await api.messages.list()
        const unreadCount = messages.filter(m => m.unread).length
        this.setData({ messages, unreadCount })
      } catch (error) {
        console.error('加载消息失败:', error)
      }
    },

    async markRead(e: any) {
      const id = e.currentTarget.dataset.id
      try {
        await api.messages.markRead(id)
        await this.loadMessages()
      } catch (error) {
        console.error('标记已读失败:', error)
      }
    },

    async markAllRead() {
      try {
        await api.messages.markAllRead()
        wx.showToast({ title: '已全部标记为已读', icon: 'success' })
        await this.loadMessages()
      } catch (error) {
        console.error('操作失败:', error)
      }
    },

    async approveWish(e: any) {
      const id = e.currentTarget.dataset.id
      const msg = this.data.messages.find(m => m.id === id)
      if (!msg?.refId) return

      try {
        await api.wishes.approve(msg.refId)
        await api.messages.markRead(id)
        wx.showToast({ title: '已同意', icon: 'success' })
        await this.loadMessages()
      } catch (error) {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    },

    async rejectWish(e: any) {
      const id = e.currentTarget.dataset.id
      const msg = this.data.messages.find(m => m.id === id)
      if (!msg?.refId) return

      wx.showModal({
        title: '拒绝心愿',
        editable: true,
        placeholderText: '可选填写拒绝原因',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.wishes.reject(msg.refId!, res.content || '')
              await api.messages.markRead(id)
              wx.showToast({ title: '已拒绝，积分已退回', icon: 'success' })
              await this.loadMessages()
            } catch (error) {
              wx.showToast({ title: '操作失败', icon: 'none' })
            }
          }
        }
      })
    },

    async viewTask(e: any) {
      const id = e.currentTarget.dataset.id
      const msg = this.data.messages.find(m => m.id === id)
      if (msg) {
        await api.messages.markRead(id)
        await this.loadMessages()
      }
      // 可跳转到任务详情
      wx.switchTab({ url: '/pages/family/index' })
    },

    getTypeText(type: string): string {
      return MESSAGE_TYPE_TEXT[type] || '📢 通知'
    },

    formatTime(timestamp: number): string {
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now.getTime() - date.getTime()

      if (diff < 60 * 1000) return '刚刚'
      if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`
      if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}天前`

      return `${date.getMonth() + 1}/${date.getDate()}`
    },
  }
})
