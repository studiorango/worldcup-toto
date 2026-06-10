'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { hashPin, getSession } from '@/lib/worldcup-auth'
import { Icon } from '@iconify/react'

const AVATAR_COLORS = [
  '#7C8C03', '#49627A', '#F94239', '#01A484',
  '#FFB803', '#9B59B6', '#E67E22', '#2980B9',
]

interface WCUserRow {
  id: string
  username: string
  display_name: string
  color: string
  is_admin: boolean
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [users, setUsers] = useState<WCUserRow[]>([])
  const [loading, setLoading] = useState(true)

  const [newUsername, setNewUsername] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0])
  const [isAdmin, setIsAdmin] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState('')

  const loadUsers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('worldcup_users')
      .select('*')
      .order('created_at')
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/'); return }
    if (!session.isAdmin) { router.replace('/dashboard'); return }
    setAuthorized(true)
    loadUsers()
  }, [router, loadUsers])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newUsername.trim() || !newDisplayName.trim() || newPin.length !== 4) return
    setCreating(true)

    try {
      const pinHash = await hashPin(newPin)
      const supabase = createClient()
      const { error } = await supabase.from('worldcup_users').insert({
        username: newUsername.trim(),
        display_name: newDisplayName.trim(),
        pin_hash: pinHash,
        color: newColor,
        is_admin: isAdmin,
      })

      if (error) {
        if (error.code === '23505') {
          showToast('이미 존재하는 아이디예요.')
        } else {
          showToast('오류: ' + error.message)
        }
      } else {
        showToast(`${newDisplayName} 계정 생성 완료!`)
        setNewUsername('')
        setNewDisplayName('')
        setNewPin('')
        setNewColor(AVATAR_COLORS[0])
        setIsAdmin(false)
        loadUsers()
      }
    } catch {
      showToast('오류가 발생했어요.')
    }
    setCreating(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} 계정을 삭제할까요?`)) return
    const supabase = createClient()
    await supabase.from('worldcup_users').delete().eq('id', id)
    showToast(`${name} 삭제 완료`)
    loadUsers()
  }

  async function handleResetPin(id: string, name: string) {
    const pin = prompt(`${name}의 새 비밀번호 4자리를 입력하세요:`)
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      alert('4자리 숫자를 입력해주세요.')
      return
    }
    const pinHash = await hashPin(pin)
    const supabase = createClient()
    await supabase.from('worldcup_users').update({ pin_hash: pinHash }).eq('id', id)
    showToast(`${name} 비밀번호 변경 완료 → ${pin}`)
  }

  if (!authorized) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7C8C03] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA]">
      <header className="bg-white/80 backdrop-blur-[12px] border-b border-[#E6E6E6] h-14 sticky top-0 z-40 flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/dashboard')} className="text-[#8B8B8B] hover:text-[#222222] transition-colors mr-1">
            <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          </button>
          <span className="text-sm font-extrabold text-[#222222] tracking-tight">관리자</span>
          <span className="text-[10px] font-bold text-white bg-[#F94239] px-1.5 py-0.5 rounded-full">ADMIN</span>
        </div>
        <span className="text-xs text-[#8B8B8B]">참가자 관리</span>
      </header>

      <main className="max-w-[600px] mx-auto px-4 py-6 pb-20">
        <section className="bg-white rounded-[16px] border border-[#E6E6E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 mb-6">
          <h2 className="text-sm font-extrabold text-[#222222] mb-4">새 참가자 추가</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#8B8B8B] mb-1 block">로그인 아이디</label>
                <input
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="민제"
                  className="w-full bg-[#F5F5F5] border border-[#E6E6E6] rounded-[10px] px-3 py-2.5 text-sm text-[#222222] placeholder:text-[#999999] focus:outline-none focus:bg-white focus:border-[#222222] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#8B8B8B] mb-1 block">표시 이름</label>
                <input
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  placeholder="김민제"
                  className="w-full bg-[#F5F5F5] border border-[#E6E6E6] rounded-[10px] px-3 py-2.5 text-sm text-[#222222] placeholder:text-[#999999] focus:outline-none focus:bg-white focus:border-[#222222] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#8B8B8B] mb-1 block">비밀번호 (4자리 숫자)</label>
              <input
                type="tel"
                inputMode="numeric"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                className="w-full bg-[#F5F5F5] border border-[#E6E6E6] rounded-[10px] px-3 py-2.5 text-sm text-[#222222] placeholder:text-[#999999] focus:outline-none focus:bg-white focus:border-[#222222] transition-colors tracking-[0.5em] font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#8B8B8B] mb-2 block">아바타 색상</label>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${newColor === c ? 'ring-2 ring-offset-2 ring-[#222222] scale-110' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setIsAdmin(v => !v)}
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${isAdmin ? 'bg-[#7C8C03]' : 'bg-[#E6E6E6]'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isAdmin ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm text-[#222222]">관리자 권한</span>
            </label>

            <button type="submit" disabled={creating || !newUsername.trim() || !newDisplayName.trim() || newPin.length !== 4}
              className="w-full bg-[#7C8C03] text-white py-3 rounded-[12px] text-sm font-semibold transition-all hover:bg-[#5A6602] active:scale-[0.98] disabled:bg-[#FAFAFA] disabled:text-[#BBBBBB]">
              {creating ? '생성 중...' : '계정 생성'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-extrabold text-[#222222] mb-3">
            참가자 목록 <span className="text-[#8B8B8B] font-normal">({users.length}명)</span>
          </h2>
          {loading ? (
            <div className="text-center py-8 text-[#BBBBBB] text-sm">불러오는 중...</div>
          ) : users.length === 0 ? (
            <div className="bg-white rounded-[14px] border border-[#E6E6E6] p-8 text-center text-[#BBBBBB] text-sm">
              참가자가 없습니다
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {users.map(u => (
                <div key={u.id} className="bg-white rounded-[14px] border border-[#E6E6E6] px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: u.color }}>
                    {u.display_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#222222]">{u.display_name}</span>
                      {u.is_admin && (
                        <span className="text-[10px] font-bold text-white bg-[#F94239] px-1.5 py-0.5 rounded-full">ADMIN</span>
                      )}
                    </div>
                    <span className="text-xs text-[#8B8B8B]">@{u.username}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleResetPin(u.id, u.display_name)}
                      className="text-[11px] text-[#49627A] bg-[#F5F7FA] border border-[#E6E6E6] px-2 py-1 rounded-[7px] font-semibold hover:bg-[#E6E6E6] transition-colors">
                      PIN 변경
                    </button>
                    <button onClick={() => handleDelete(u.id, u.display_name)}
                      className="text-[11px] text-[#F94239] bg-[#FFF5F5] border border-[#F94239]/20 px-2 py-1 rounded-[7px] font-semibold hover:bg-[#FFEDEA] transition-colors">
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#222222] text-white text-sm font-medium px-5 py-3 rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.16)] z-50 whitespace-nowrap animate-[fadeInUp_0.2s_ease]">
          {toast}
        </div>
      )}
    </div>
  )
}
