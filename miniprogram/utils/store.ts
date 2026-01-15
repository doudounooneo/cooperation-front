type Key = 'user' | 'families' | 'currentFamilyId' | 'tasks' | 'wishes' | 'messages' | 'balances'

export function get<T = any>(key: Key, def: T = (undefined as any)) : T {
  const v = wx.getStorageSync(key)
  return (v === '' || v === undefined) ? def : v
}

export function set(key: Key, value: any) { wx.setStorageSync(key, value) }

export function remove(key: Key) { wx.removeStorageSync(key) }

export function update(key: Key, updater: (prev: any) => any) {
  const prev = get<any>(key, undefined)
  const next = updater(prev)
  set(key, next)
  return next
}
